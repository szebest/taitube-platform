import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, err, isErr, map, ok, unwrapOr } from '@kit/result';
import type { AuthorizationPort, ReactionCachePort } from '@vp/core/ports';
import type {
  ChannelRepositoryPort,
  VideoChapterRepository,
  VideoRecord,
  VideoWithDetails,
} from '@vp/core/repositories';
import { PUBLIC_FEED_SEEN_LIMIT, type VideoFormat, type VideoStatus } from '@vp/domain';
import { type ReadVideoFailure, decideVideoRead, videoNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { type UserContext, canAccessAdmin } from '@vp/permissions';
import {
  type FeedCursor,
  type FeedSort,
  createdAtCursorPayload,
  decodeCreatedAtCursor,
  decodeFeedCursor,
  feedCursorPayload,
} from './cursor';
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
  type SpriteGeometry,
  type VideoCardView,
  type VideoDetailView,
  type VideoSummaryView,
  loadChannelsOf,
  toVideoCardView,
  toVideoDetailView,
  toVideoSummaryView,
} from './video-views';

export * from './video-lifecycle';
export * from './video-views';

export interface VideoServiceDeps extends VideoLifecycleDeps {
  cdn: CdnBase;
  sprite: SpriteGeometry;
  channels: ChannelRepositoryPort;
  chapters: VideoChapterRepository;
  reactionCache: ReactionCachePort;
  authorization: AuthorizationPort;
  paginator: Paginator;
}

function seenAfter(cursor: FeedCursor | null, served: readonly { id: string }[]): string[] {
  return [...(cursor?.seen ?? []), ...served.map((video) => video.id)].slice(
    -PUBLIC_FEED_SEEN_LIMIT
  );
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
      rows.value.map((v) => v.channelId)
    );
    return map(channelOf, (of) =>
      this.deps.paginator.paginate(rows.value, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (v) => toVideoSummaryView(v, this.deps.cdn, this.deps.sprite, of(v.channelId)),
      })
    );
  }

  /** Attaches each video's channel to cards read from a page cache, in one read. */
  async withChannels(
    cards: readonly VideoCardView[]
  ): Promise<Result<VideoSummaryView[], DatabaseUnavailable>> {
    const channelOf = await loadChannelsOf(
      this.deps.channels,
      cards.map((card) => card.channelId)
    );
    return map(channelOf, (of) => cards.map((card) => ({ ...card, channel: of(card.channelId) })));
  }

  async summarize(
    videos: readonly VideoRecord[]
  ): Promise<Result<VideoSummaryView[], DatabaseUnavailable>> {
    const channelOf = await loadChannelsOf(
      this.deps.channels,
      videos.map((video) => video.channelId)
    );
    return map(channelOf, (of) =>
      videos.map((video) =>
        toVideoSummaryView(video, this.deps.cdn, this.deps.sprite, of(video.channelId))
      )
    );
  }

  async listPublic(options: {
    sort?: FeedSort;
    categoryId?: string;
    channelId?: string;
    format?: VideoFormat;
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
      channelId: options.channelId,
      format: options.format,
      cursor: cursor.value,
      limit,
    });

    return map(found, (result) => {
      const seen = sort === 'shorts' ? seenAfter(cursor.value, result.items.slice(0, limit)) : [];
      return {
        ...this.deps.paginator.paginate(result.items, limit, {
          cursorOf: (row) => feedCursorPayload(row, result.instant, seen),
          toItem: (v) => toVideoCardView(v, this.deps.cdn, this.deps.sprite),
        }),
        total: result.total,
      };
    });
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

    const decided = decideVideoRead({ viewer, video: found.value?.video ?? null, videoId });
    if (isErr(decided)) return decided;
    return found.value ? this.detail(found.value) : err(videoNotFound(videoId));
  }

  /** The view of a video its caller was let read, with its live counters, channel and chapters. */
  async detail(details: VideoWithDetails): Promise<Result<VideoDetailView, DatabaseUnavailable>> {
    const { video } = details;
    const view = toVideoDetailView(
      video,
      details.renditions,
      this.deps.cdn,
      this.deps.sprite,
      details.events
    );

    const stored = { likesCount: video.likesCount ?? 0, dislikesCount: video.dislikesCount ?? 0 };
    // A dead cache costs the stored counters their refresh, not the video its response.
    const counts = unwrapOr(
      await this.deps.reactionCache.getCounts(video.id, async () => ok(stored)),
      stored
    );
    view.likesCount = counts.likesCount;
    view.dislikesCount = counts.dislikesCount;

    const channelOf = await loadChannelsOf(this.deps.channels, [view.channelId]);
    if (isErr(channelOf)) return channelOf;
    view.channel = channelOf.value(view.channelId);

    const chapters = await this.deps.chapters.listFor([video.id]);
    if (isErr(chapters)) return chapters;
    view.chapters = chapters.value.get(video.id) ?? [];

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
