import type { AuthorizationPort, ReactionCachePort } from '@vp/core/ports';
import type { VideoStatus, VideoVisibility } from '@vp/domain';
import {
  type ReadVideoFailure,
  type UpdateVideoMetadataFailure,
  decideVideoMetadataUpdate,
  decideVideoRead,
  videoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import { type UserContext, canAccessAdmin } from '@vp/permissions';
import { type Result, err, isErr, map, ok, unwrapOr } from '@vp/result';
import type { DispatchOrigin } from './probe-dispatch';
import {
  type ReprocessResult,
  type SoftDeleteResult,
  type VideoLifecycleDeps,
  type VideoLifecycleServiceFailure,
  reprocessVideo,
  softDeleteVideo,
} from './video-lifecycle';

import {
  type FeedSort,
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  feedCursorPayload,
} from './cursor';
import {
  type VideoDetailView,
  type VideoSummaryView,
  toVideoDetailView,
  toVideoSummaryView,
} from './video-views';

export * from './video-lifecycle';
export * from './video-views';

export interface VideoServiceDeps extends VideoLifecycleDeps {
  cdn: CdnBase;
  reactionCache: ReactionCachePort;
  authorization: AuthorizationPort;
  paginator: Paginator;
}

export type ListVideosFailure = DatabaseUnavailable | InvalidCursor;

export type ReadVideoServiceFailure = ReadVideoFailure | DatabaseUnavailable;

export type UpdateVideoServiceFailure =
  | UpdateVideoMetadataFailure
  | ReadVideoServiceFailure
  | VersionConflict;

export class VideoService {
  constructor(private readonly deps: VideoServiceDeps) {}

  async list(
    user: UserContext,
    options: { cursor?: string; limit?: number; status?: VideoStatus }
  ): Promise<Result<{ items: VideoSummaryView[]; nextCursor: string | null }, ListVideosFailure>> {
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.videos.listByOwner({
      ownerId: user.id,
      viewer: user,
      cursor: cursor.value,
      limit,
      status: options.status,
    });

    return map(rows, (found) =>
      this.deps.paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (v) => toVideoSummaryView(v, this.deps.cdn),
      })
    );
  }

  async listPublic(options: {
    sort?: FeedSort;
    categoryId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<
    Result<
      { items: VideoSummaryView[]; nextCursor: string | null; total: number },
      ListVideosFailure
    >
  > {
    const sort = options.sort ?? 'recent';
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeFeedCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const found = await this.deps.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      cursor: cursor.value,
      limit,
    });

    return map(found, (result) => ({
      ...this.deps.paginator.paginate(result.items, limit, {
        cursorOf: (row) => feedCursorPayload(row, result.instant),
        toItem: (v) => toVideoSummaryView(v, this.deps.cdn),
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
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<VideoDetailView, ReadVideoServiceFailure>> {
    const found = await this.deps.videos.findWithDetails(videoId);
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
      this.deps.cdn,
      details.events
    );

    const stored = {
      likesCount: decided.value.likesCount ?? 0,
      dislikesCount: decided.value.dislikesCount ?? 0,
    };
    // A dead cache costs the stored counters their refresh, not the video its response.
    const counts = unwrapOr(
      await this.deps.reactionCache.getCounts(videoId, async () => ok(stored)),
      stored
    );
    view.likesCount = counts.likesCount;
    view.dislikesCount = counts.dislikesCount;

    return ok(view);
  }

  async updateMetadata(
    user: UserContext,
    videoId: string,
    input: {
      title?: string;
      description?: string;
      visibility?: VideoVisibility;
      version: number;
    }
  ): Promise<Result<VideoDetailView, UpdateVideoServiceFailure>> {
    const existing = await this.deps.videos.findById(videoId);
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

    const updated = await this.deps.videos.updateMetadata({
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
  isRateLimitExempt(user: UserContext): boolean {
    return this.deps.authorization.can(canAccessAdmin, { user });
  }

  reprocess(
    user: UserContext,
    videoId: string,
    origin: DispatchOrigin = {}
  ): Promise<Result<ReprocessResult, VideoLifecycleServiceFailure>> {
    return reprocessVideo(this.deps, user, videoId, origin);
  }

  softDelete(
    user: UserContext,
    videoId: string
  ): Promise<Result<SoftDeleteResult, VideoLifecycleServiceFailure>> {
    return softDeleteVideo(this.deps, user, videoId);
  }
}
