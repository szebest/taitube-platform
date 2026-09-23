import { CaslAuthorizationAdapter } from '@vp/adapters';
import type { AuthorizationPort, JobQueue, ReactionCachePort } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import type { VideoStatus, VideoVisibility } from '@vp/domain';
import {
  type ReadVideoFailure,
  type UpdateVideoMetadataFailure,
  decideVideoMetadataUpdate,
  decideVideoRead,
  videoNotFound,
} from '@vp/domain-rules';
import { DEFAULT_CDN_BASE_URL } from '@vp/env-schema';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { type Paginator, defaultPaginator } from '@vp/pagination';
import { canAccessAdmin } from '@vp/permissions';
import { type Result, err, isErr, map, ok, unwrapOr } from '@vp/result';
import type { AuthUser } from '../plugins/auth';
import {
  type ReprocessResult,
  type SoftDeleteResult,
  type VideoLifecycleDeps,
  type VideoLifecycleServiceFailure,
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

/**
 * VideoService — Deep domain module for video operations and projections (SDD §6.1, §6.3).
 */
export type ReadVideoServiceFailure = ReadVideoFailure | DatabaseUnavailable;

export type UpdateVideoServiceFailure =
  | UpdateVideoMetadataFailure
  | ReadVideoServiceFailure
  | VersionConflict;

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
  ): Promise<
    Result<{ items: VideoSummaryView[]; nextCursor: string | null }, DatabaseUnavailable>
  > {
    const limit = this.paginator.limit(options.limit);

    const rows = await this.videos.listByOwner({
      ownerId: user.id,
      viewer: user,
      cursor: decodeCreatedAtCursor(options.cursor, this.paginator),
      limit,
      status: options.status,
    });

    return map(rows, (found) =>
      this.paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (v) => toVideoSummaryView(v, this.cleanCdnBase),
      })
    );
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
  }): Promise<
    Result<
      { items: VideoSummaryView[]; nextCursor: string | null; total: number },
      DatabaseUnavailable
    >
  > {
    const sort = options.sort ?? 'recent';
    const limit = this.paginator.limit(options.limit);

    const found = await this.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      cursor: decodeFeedCursor(options.cursor, this.paginator),
      limit,
    });

    return map(found, (result) => ({
      ...this.paginator.paginate(result.items, limit, {
        cursorOf: (row) => feedCursorPayload(row, result.instant),
        toItem: (v) => toVideoSummaryView(v, this.cleanCdnBase),
      }),
      total: result.total,
    }));
  }

  /**
   * Absent and forbidden stay distinct all the way out. The public route renders both as 404 and
   * the admin route renders the second as 403; this service is never asked to choose, which is the
   * whole point of ADR-24.
   */
  async get(
    viewer: AuthUser | null,
    videoId: string
  ): Promise<Result<VideoDetailView, ReadVideoServiceFailure>> {
    const found = await this.videos.findWithDetails(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoRead({
      viewer,
      video: found.value?.video ?? null,
      videoId,
    });
    if (isErr(decided)) return decided;

    const details = found.value;
    if (!details) return err(videoNotFound(videoId));

    const view = toVideoDetailView(
      decided.value,
      details.renditions,
      this.cleanCdnBase,
      details.events
    );

    if (this.reactionCache) {
      const stored = {
        likesCount: decided.value.likesCount ?? 0,
        dislikesCount: decided.value.dislikesCount ?? 0,
      };
      // A dead cache costs the stored counters their refresh, not the video its response.
      const counts = unwrapOr(
        await this.reactionCache.getCounts(videoId, async () => ok(stored)),
        stored
      );
      view.likesCount = counts.likesCount;
      view.dislikesCount = counts.dislikesCount;
    }

    return ok(view);
  }

  async updateMetadata(
    user: AuthUser,
    videoId: string,
    input: {
      title?: string;
      description?: string;
      visibility?: VideoVisibility;
      version: number;
    }
  ): Promise<Result<VideoDetailView, UpdateVideoServiceFailure>> {
    const existing = await this.videos.findById(videoId);
    if (isErr(existing)) return existing;

    const { version, ...patch } = input;
    const decided = decideVideoMetadataUpdate({
      editor: user,
      video: existing.value,
      videoId,
      patch,
    });
    if (isErr(decided)) return decided;

    if (existing.value && existing.value.version !== version) {
      return err(versionConflict(videoId, version));
    }

    const updated = await this.videos.updateMetadata({
      videoId,
      expectedVersion: version,
      patch,
      userId: user.id,
    });
    if (isErr(updated)) return updated;
    if (!updated.value) return err(videoNotFound(videoId));

    return await this.get(user, videoId);
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
  ): Promise<Result<ReprocessResult, VideoLifecycleServiceFailure>> {
    return reprocessVideo(this.lifecycle, user, videoId, options);
  }

  softDelete(
    user: AuthUser,
    videoId: string
  ): Promise<Result<SoftDeleteResult, VideoLifecycleServiceFailure>> {
    return softDeleteVideo(this.lifecycle, user, videoId);
  }
}
