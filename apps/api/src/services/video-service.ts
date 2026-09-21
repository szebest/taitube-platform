import { CaslAuthorizationAdapter } from '@vp/adapters';
import { publicFeedInstant, trendingScore, videoAgeHours } from '@vp/core/domain';
import { type Paginator, defaultPaginator } from '@vp/core/pagination';
import type {
  AuthorizationPort,
  JobQueue,
  ReactionCachePort,
  VideoRepository,
  VideoStatus,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import {
  type UserContext,
  canAccessAdmin,
  canDeleteVideo,
  canReadVideo,
  canUpdateVideo,
  parseRole,
} from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';
import { buildProbeDispatch, enqueueProbe } from './probe-dispatch';

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

export {
  encodeVideoCursor,
  decodeVideoCursor,
  encodeFeedCursor,
  decodeFeedCursor,
  type FeedSort,
} from './cursor';

import {
  type FeedSort,
  decodeFeedCursor,
  decodeVideoCursor,
  feedCursorPayload,
  videoCursorPayload,
} from './cursor';

export const REPROCESSABLE_STATUSES: VideoStatus[] = ['READY', 'FAILED', 'PROCESSING'];

export interface ReprocessResult {
  videoId: string;
  status: 'PROBING';
  generation: number;
}

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
  private readonly probeQueue?: JobQueue;

  constructor(deps: VideoServiceDeps) {
    this.videos = deps.videos;
    this.reactionCache = deps.reactionCache;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
    this.paginator = deps.paginator ?? defaultPaginator;
    this.probeQueue = deps.probeQueue;
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
    const limit = this.paginator.limit(options.limit);

    const rows = await this.videos.listByOwner({
      ownerId: user.id,
      viewer: { id: user.id, role: parseRole(user.role) },
      cursor: decodeVideoCursor(options.cursor, this.paginator),
      limit,
      status: options.status,
    });

    return this.paginator.paginate(rows, limit, {
      cursorOf: videoCursorPayload,
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
   * Admins are not throttled on reprocess; the route only asks, it does not decide.
   */
  isRateLimitExempt(user: AuthUser): boolean {
    return this.auth.can(canAccessAdmin, { user: { id: user.id, role: parseRole(user.role) } });
  }

  /**
   * Re-runs the pipeline for an existing source under a fresh generation (SDD §6.3).
   */
  async reprocess(
    user: AuthUser,
    videoId: string,
    options: { traceparent?: string } = {}
  ): Promise<ReprocessResult> {
    const video = await this.videos.findById(videoId);
    if (!video) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const userContext: UserContext = { id: user.id, role: parseRole(user.role) };

    this.auth.assertCan(
      canUpdateVideo,
      { user: userContext, video },
      {
        action: 'update',
        subject: 'Video',
        message: 'Only the video owner or an admin may reprocess this video',
      }
    );

    if (!REPROCESSABLE_STATUSES.includes(video.status)) {
      throw new PermanentError(
        ErrorCodes.VALIDATION_FAILED,
        `Cannot reprocess video with status ${video.status}. Must be ${REPROCESSABLE_STATUSES.join(', ')}.`
      );
    }

    const generation = (video.generation || 1) + 1;
    const dispatch = buildProbeDispatch({
      videoId,
      sourceKey: video.sourceKey,
      generation,
      traceparent: options.traceparent || getActiveTraceparent() || createTraceparent(),
    });

    const transitioned = await this.videos.transition({
      videoId,
      from: REPROCESSABLE_STATUSES,
      to: 'PROBING',
      eventType: 'video.reprocessing',
      eventPayload: { generation, requestedBy: user.id },
      patch: { generation, errorCode: null, errorMessage: null },
      outbox: dispatch.outbox,
    });

    if (!transitioned) {
      throw new PermanentError(
        ErrorCodes.VERSION_CONFLICT,
        'State conflict while transitioning video to PROBING for reprocess'
      );
    }

    await enqueueProbe(this.probeQueue, dispatch);

    return { videoId, status: 'PROBING', generation };
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
