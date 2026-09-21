import { CaslAuthorizationAdapter } from '@vp/adapters';
import { DEFAULT_CDN_BASE_URL } from '@vp/config';
import type { AuthorizationPort, JobQueue, ReactionCachePort } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import { type VideoStatus, publicFeedInstant, trendingScore, videoAgeHours } from '@vp/domain';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type Paginator, defaultPaginator } from '@vp/pagination';
import { canAccessAdmin, canReadVideo, canUpdateVideo } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';
import {
  type ReprocessResult,
  type SoftDeleteResult,
  type VideoLifecycleDeps,
  reprocessVideo,
  softDeleteVideo,
} from './video-lifecycle';

export * from './video-lifecycle';

export * from './video-views';
import {
  type VideoDetailView,
  type VideoSummaryView,
  toVideoDetailView,
  toVideoSummaryView,
} from './video-views';

export interface VideoServiceDeps {
  videos: VideoRepository;
  cdnBaseUrl?: string;
  reactionCache?: ReactionCachePort;
  authorization?: AuthorizationPort;
  paginator?: Paginator;
  probeQueue?: JobQueue;
}

import {
  type FeedSort,
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  feedCursorPayload,
} from './cursor';

function gravityScore(row: { createdAt: Date; viewsCount?: number }, sort: FeedSort) {
  if (sort !== 'trending') return undefined;
  return trendingScore(row.viewsCount ?? 0, videoAgeHours(row.createdAt, publicFeedInstant()));
}

/**
 * VideoService — Deep domain module for video operations and projections (SDD §6.1, §6.3).
 */
export class VideoService {
  private readonly videos: VideoRepository;
  private readonly cleanCdnBase: string;
  private readonly reactionCache?: ReactionCachePort;
  private readonly auth: AuthorizationPort;
  private readonly paginator: Paginator;
  private readonly lifecycle: VideoLifecycleDeps;

  constructor(deps: VideoServiceDeps) {
    this.videos = deps.videos;
    this.reactionCache = deps.reactionCache;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
    this.paginator = deps.paginator ?? defaultPaginator;
    this.lifecycle = {
      videos: this.videos,
      auth: this.auth,
      ...(deps.probeQueue ? { probeQueue: deps.probeQueue } : {}),
    };
    const cdnBase = deps.cdnBaseUrl || process.env['CDN_BASE_URL'] || DEFAULT_CDN_BASE_URL;
    this.cleanCdnBase = cdnBase.replace(/\/+$/, '');
  }

  /**
   * Keyset paginated video list scoped to caller (SDD §6.1, PRD US-12).
   */
  async list(
    user: AuthUser,
    options: { cursor?: string; limit?: number; status?: VideoStatus }
  ): Promise<{ items: VideoSummaryView[]; nextCursor: string | null }> {
    const limit = this.paginator.limit(options.limit);

    const rows = await this.videos.listByOwner({
      ownerId: user.id,
      viewer: user,
      cursor: decodeCreatedAtCursor(options.cursor, this.paginator),
      limit,
      status: options.status,
    });

    return this.paginator.paginate(rows, limit, {
      cursorOf: createdAtCursorPayload,
      toItem: (v) => toVideoSummaryView(v, this.cleanCdnBase),
    });
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
    const limit = this.paginator.limit(options.limit);

    const result = await this.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      cursor: decodeFeedCursor(options.cursor, this.paginator),
      limit,
    });

    const page = this.paginator.paginate(result.items, limit, {
      cursorOf: (row) => feedCursorPayload(row, sort, gravityScore(row, sort)),
      toItem: (v) => toVideoSummaryView(v, this.cleanCdnBase),
    });

    return { ...page, total: result.total };
  }

  /**
   * Retrieves video details and enforces visibility access control (SDD §6.1, §11).
   */
  async get(user: AuthUser | null, videoId: string): Promise<VideoDetailView> {
    const details = await this.videos.findWithDetails(videoId);
    if (!details)
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const { video, renditions: videoRenditions } = details;

    const canRead = this.auth.can(canReadVideo, { user: user, video });
    if (!canRead) {
      if (!user) {
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

    if (!this.auth.can(canReadVideo, { user: user, video: existing })) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    this.auth.assertCan(
      canUpdateVideo,
      { user: user, video: existing },
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
   * Admins are not throttled on reprocess; the route only asks, it does not decide.
   */
  isRateLimitExempt(user: AuthUser): boolean {
    return this.auth.can(canAccessAdmin, { user });
  }

  reprocess(
    user: AuthUser,
    videoId: string,
    options: { traceparent?: string } = {}
  ): Promise<ReprocessResult> {
    return reprocessVideo(this.lifecycle, user, videoId, options);
  }

  softDelete(user: AuthUser, videoId: string): Promise<SoftDeleteResult> {
    return softDeleteVideo(this.lifecycle, user, videoId);
  }
}
