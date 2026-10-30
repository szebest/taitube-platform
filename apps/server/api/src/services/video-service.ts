import type { AuthorizationPort, ReactionCachePort } from '@vp/core/ports';
import type { ChannelRepositoryPort, VideoRecord } from '@vp/core/repositories';
import type { VideoStatus } from '@vp/domain';
import { decideVideoRead, type ReadVideoFailure, videoNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import { canAccessAdmin, type UserContext } from '@vp/permissions';
import { err, isErr, map, ok, type Result, unwrapOr } from '@vp/result';
import {
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  type FeedSort,
  feedCursorPayload,
} from './cursor';
import type { DispatchOrigin } from './probe-dispatch';
import {
  type ReprocessResult,
  reprocessVideo,
  type SoftDeleteResult,
  softDeleteVideo,
  type VideoLifecycleDeps,
  type VideoLifecycleServiceFailure,
} from './video-lifecycle';
import {
  loadChannelsOf,
  type SpriteGeometry,
  toVideoCardView,
  toVideoDetailView,
  toVideoSummaryView,
  type VideoCardView,
  type VideoDetailView,
  type VideoSummaryView,
} from './video-views';

export * from './video-lifecycle';
export * from './video-views';

export interface VideoServiceDeps extends VideoLifecycleDeps {
  cdn: CdnBase;
  sprite: SpriteGeometry;
  channels: ChannelRepositoryPort;
  reactionCache: ReactionCachePort;
  authorization: AuthorizationPort;
  paginator: Paginator;
}

export type ListVideosFailure = DatabaseUnavailable | InvalidCursor;

export type ReadVideoServiceFailure = ReadVideoFailure | DatabaseUnavailable;

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

    if (isErr(rows)) return rows;

    const channelOf = await loadChannelsOf(
      this.deps.channels,
      rows.value.map((v) => v.ownerId)
    );
    return map(channelOf, (of) =>
      this.deps.paginator.paginate(rows.value, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (v) => toVideoSummaryView(v, this.deps.cdn, this.deps.sprite, of(v.ownerId)),
      })
    );
  }

  /** Attaches each owner's channel to cards read from a page cache, in one read. */
  async withChannels(
    cards: readonly VideoCardView[]
  ): Promise<Result<VideoSummaryView[], DatabaseUnavailable>> {
    const channelOf = await loadChannelsOf(
      this.deps.channels,
      cards.map((card) => card.ownerId)
    );
    return map(channelOf, (of) => cards.map((card) => ({ ...card, channel: of(card.ownerId) })));
  }

  async summarize(
    videos: readonly VideoRecord[]
  ): Promise<Result<VideoSummaryView[], DatabaseUnavailable>> {
    const channelOf = await loadChannelsOf(
      this.deps.channels,
      videos.map((video) => video.ownerId)
    );
    return map(channelOf, (of) =>
      videos.map((video) =>
        toVideoSummaryView(video, this.deps.cdn, this.deps.sprite, of(video.ownerId))
      )
    );
  }

  async listPublic(options: {
    sort?: FeedSort;
    categoryId?: string;
    ownerId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<
    Result<{ items: VideoCardView[]; nextCursor: string | null; total: number }, ListVideosFailure>
  > {
    const sort = options.sort ?? 'recent';
    const limit = this.deps.paginator.limit(options.limit);
    const cursor = decodeFeedCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const found = await this.deps.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      ownerId: options.ownerId,
      cursor: cursor.value,
      limit,
    });

    return map(found, (result) => ({
      ...this.deps.paginator.paginate(result.items, limit, {
        cursorOf: (row) => feedCursorPayload(row, result.instant),
        toItem: (v) => toVideoCardView(v, this.deps.cdn, this.deps.sprite),
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
