import { CaslAuthorizationAdapter } from '@vp/adapters';
import type {
  AuthorizationPort,
  ReactionCachePort,
  VideoRepository,
  VideoStatus,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import {
  type UserContext,
  canDeleteVideo,
  canReadVideo,
  canUpdateVideo,
  parseRole,
} from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';

export * from './types';
import {
  type VideoDetailView,
  type VideoServiceDeps,
  type VideoSummaryView,
  toVideoDetailView,
  toVideoSummaryView,
} from './types';

export {
  encodeVideoCursor,
  decodeVideoCursor,
  encodeFeedCursor,
  decodeFeedCursor,
  type FeedSort,
} from './cursor';

import {
  decodeFeedCursor,
  decodeVideoCursor,
  encodeFeedCursor,
  encodeVideoCursor,
  type FeedSort,
} from './cursor';

/**
 * VideoService — Deep domain module for video operations and projections (SDD §6.1, §6.3).
 */
export class VideoService {
  private readonly videos: VideoRepository;
  private readonly cleanCdnBase: string;
  private readonly reactionCache?: ReactionCachePort;
  private readonly auth: AuthorizationPort;

  constructor(deps: VideoServiceDeps) {
    this.videos = deps.videos;
    this.reactionCache = deps.reactionCache;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
    const cdnBase =
      deps.cdnBaseUrl || process.env['CDN_BASE_URL'] || 'http://localhost:9000/public';
    this.cleanCdnBase = cdnBase.replace(/\/+$/, '');
  }

  /**
   * Keyset paginated video list scoped to caller (SDD §6.1, PRD US-12).
   */
  async list(
    user: AuthUser,
    options: { cursor?: string; limit?: number; status?: VideoStatus }
  ): Promise<{ items: VideoSummaryView[]; nextCursor: string | null }> {
    const decodedCursor = decodeVideoCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const rows = await this.videos.listByOwner({
      ownerId: user.id,
      viewer: { id: user.id, role: parseRole(user.role) },
      cursor: decodedCursor,
      limit,
      status: options.status,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1] : undefined;
    const nextCursor = lastRow ? encodeVideoCursor(lastRow) : null;

    const items: VideoSummaryView[] = pageRows.map((v) => toVideoSummaryView(v, this.cleanCdnBase));

    return { items, nextCursor };
  }

  /**
   * Keyset paginated public video feed (PRD US-12, FR-14, SDD §6.1).
   * Unauthenticated: queries visibility = 'public' AND status = 'READY'.
   */
  async listPublic(options: {
    sort?: FeedSort;
    categoryId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: VideoSummaryView[]; nextCursor: string | null; total: number }> {
    const sort = options.sort ?? 'recent';
    const decodedCursor = decodeFeedCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const result = await this.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      cursor: decodedCursor,
      limit,
    });

    const hasMore = result.items.length > limit;
    const pageRows = hasMore ? result.items.slice(0, limit) : result.items;
    const lastRow = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1] : undefined;

    let nextCursor: string | null = null;
    if (lastRow) {
      let score: number | undefined;
      if (sort === 'trending') {
        const ageHours = Math.max(0, (Date.now() - lastRow.createdAt.getTime()) / 3600000);
        score = ((lastRow.viewsCount ?? 0) + 1) / (ageHours + 2) ** 1.5;
      }
      nextCursor = encodeFeedCursor(lastRow, sort, score);
    }

    const items: VideoSummaryView[] = pageRows.map((v) => toVideoSummaryView(v, this.cleanCdnBase));

    return { items, nextCursor, total: result.total };
  }

  /**
   * Retrieves video details and enforces visibility access control (SDD §6.1, §11).
   */
  async get(user: AuthUser | null, videoId: string): Promise<VideoDetailView> {
    const details = await this.videos.findWithDetails(videoId);
    if (!details)
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const { video, renditions: videoRenditions } = details;
    const userContext: UserContext | null = user
      ? { id: user.id, role: parseRole(user.role) }
      : null;

    const canRead = this.auth.can(canReadVideo, { user: userContext, video });
    if (!canRead) {
      if (!userContext) {
        this.auth.assertCan(
          canReadVideo,
          { user: null, video },
          {
            action: 'read',
            subject: 'Video',
            message: 'Authentication required to view private video',
          }
        );
      }
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    const view = toVideoDetailView(video, videoRenditions, this.cleanCdnBase, details.events);
    if (this.reactionCache) {
      const counts = await this.reactionCache.getCounts(videoId, async () => ({
        likesCount: video.likesCount ?? 0,
        dislikesCount: video.dislikesCount ?? 0,
      }));
      view.likesCount = counts.likesCount;
      view.dislikesCount = counts.dislikesCount;
    }
    return view;
  }

  /**
   * Updates video metadata with optimistic locking on version (SDD §6.1).
   */
  async updateMetadata(
    user: AuthUser,
    videoId: string,
    input: {
      title?: string;
      description?: string;
      visibility?: 'private' | 'unlisted' | 'public';
      version: number;
    }
  ): Promise<VideoDetailView> {
    const existing = await this.videos.findById(videoId);
    if (!existing)
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const userContext: UserContext = { id: user.id, role: parseRole(user.role) };

    if (!this.auth.can(canReadVideo, { user: userContext, video: existing })) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    this.auth.assertCan(
      canUpdateVideo,
      { user: userContext, video: existing },
      {
        action: 'update',
        subject: 'Video',
        message: 'Only the video owner or an admin may edit video metadata',
      }
    );

    if (existing.version !== input.version) {
      throw new PermanentError(
        ErrorCodes.VERSION_CONFLICT,
        `Version conflict on video ${videoId}: expected version ${input.version}, got ${existing.version}`
      );
    }

    const patch: {
      title?: string;
      description?: string;
      visibility?: 'private' | 'unlisted' | 'public';
    } = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.visibility !== undefined) patch.visibility = input.visibility;

    try {
      await this.videos.updateMetadata({
        videoId,
        expectedVersion: input.version,
        patch,
        userId: user.id,
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'VERSION_CONFLICT') {
        throw new PermanentError(ErrorCodes.VERSION_CONFLICT, (err as Error).message);
      }
      throw err;
    }

    return this.get(user, videoId);
  }

  /**
   * Soft deletes a video (SDD §6.1, §9.8, Ticket 17 AC 4).
   */
  async softDelete(
    user: AuthUser,
    videoId: string
  ): Promise<{ videoId: string; status: 'DELETED' }> {
    const video = await this.videos.findById(videoId);
    if (!video) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const userContext: UserContext = { id: user.id, role: parseRole(user.role) };

    this.auth.assertCan(
      canDeleteVideo,
      { user: userContext, video },
      {
        action: 'delete',
        subject: 'Video',
        message: 'Only the video owner or an admin may delete this video',
      }
    );

    if (video.status === 'DELETED') return { videoId, status: 'DELETED' };

    const allowedFrom: VideoStatus[] = [
      'UPLOADING',
      'UPLOADED',
      'PROBING',
      'PROCESSING',
      'READY',
      'FAILED',
      'REJECTED',
      'ABANDONED',
    ];

    const transitioned = await this.videos.transition({
      videoId,
      from: allowedFrom,
      to: 'DELETED',
      eventType: 'video.deleted',
      eventPayload: { requestedBy: user.id },
      patch: { deletedAt: new Date() },
    });

    if (!transitioned) {
      throw new PermanentError(
        ErrorCodes.VERSION_CONFLICT,
        'State conflict while transitioning video to DELETED'
      );
    }

    return { videoId, status: 'DELETED' };
  }
}
