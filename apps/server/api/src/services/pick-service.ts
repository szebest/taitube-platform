import {
  type CreatePickBody,
  CurrentPickSchema,
  type CurrentPickView,
  type ListPicksQuery,
  type PickListView,
  type PickView,
  type UpdatePickBody,
} from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  PickRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import { type EditorPick, toChannelCard, type Video } from '@vp/domain';
import {
  type AuthorizationFailure,
  type CreatePickFailure,
  type DeletePickFailure,
  decideAdminAccess,
  decidePickCreate,
  decidePickDelete,
  decidePickUpdate,
  decidePickVideo,
  type NothingToPick,
  nothingToPick,
  pickNotFound,
  type UpdatePickFailure,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { andThenAsync, err, isErr, isOk, map, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { CurrentPickCache } from './current-pick-cache';
import type { FeedService } from './feed-service';
import { buildCacheHeaders, generateEtag, isNotModified } from './http-cache';
import { toFallbackView, toPickView, toScheduledView } from './pick-views';
import type { ListVideosFailure } from './video-service';
import type { SpriteGeometry } from './video-views';

export interface PickServiceDeps {
  picks: PickRepositoryPort;
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  feed: Pick<FeedService, 'getFeed'>;
  currentCache: CurrentPickCache;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  now: () => number;
}

export interface CurrentPickPage {
  data: CurrentPickView;
  headers: Record<string, string>;
  notModified: boolean;
}

export type CurrentPickServiceFailure = ListVideosFailure | NothingToPick;
export type ListPicksServiceFailure = AuthorizationFailure | DatabaseUnavailable;
export type CreatePickServiceFailure = CreatePickFailure | DatabaseUnavailable;
export type UpdatePickServiceFailure = UpdatePickFailure | DatabaseUnavailable;
export type CancelPickServiceFailure = DeletePickFailure | DatabaseUnavailable;

const DEFAULT_RANGE_MS = 30 * 24 * 3_600_000;

/**
 * Picks are written by admins and read by everyone. Every verdict comes from `@vp/domain-rules`;
 * the service reads what a rule needs, writes what it allowed and drops the cached current pick
 * after any write that committed.
 */
export class PickService {
  constructor(private readonly deps: PickServiceDeps) {}

  /**
   * Windows never overlap, so there is no "next" pick to fall to when the current one's video
   * stopped being public and ready: the top trending video stands in until the window ends.
   */
  async current(ifNoneMatch?: string): Promise<Result<CurrentPickPage, CurrentPickServiceFailure>> {
    const at = this.deps.now();
    const cached = await this.deps.currentCache.read(at);
    const resolved = cached ? ok(cached) : await this.resolve(at);
    return map(resolved, (data) => this.page(data, at, ifNoneMatch));
  }

  async list(
    caller: UserContext | null,
    query: ListPicksQuery
  ): Promise<Result<PickListView, ListPicksServiceFailure>> {
    const admin = decideAdminAccess(caller);
    if (isErr(admin)) return admin;

    const from = query.from ? new Date(query.from) : new Date(this.deps.now());
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + DEFAULT_RANGE_MS);
    const found = await this.deps.picks.listBetween({ from, to });
    return map(found, (entries) => ({
      items: entries.map((entry) => toPickView(entry, this.deps.cdn, this.deps.sprite)),
    }));
  }

  async create(
    caller: UserContext | null,
    body: CreatePickBody
  ): Promise<Result<PickView, CreatePickServiceFailure>> {
    const window = { startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt) };
    const video = await this.deps.videos.findById(body.videoId);
    if (isErr(video)) return video;
    const overlapping = await this.deps.picks.findOverlapping(window);
    if (isErr(overlapping)) return overlapping;

    const now = new Date(this.deps.now());
    const decided = decidePickCreate({
      actor: caller,
      video: video.value,
      videoId: body.videoId,
      ...window,
      note: body.note,
      now,
      overlapping: overlapping.value,
    });
    return andThenAsync(decided, async ({ pick, video: picked }) => {
      const stored: EditorPick = { ...pick, id: uuidv7(), createdAt: now };
      const written = await this.deps.picks.create(stored);
      return andThenAsync(written, () => this.committed(stored, picked));
    });
  }

  async update(
    caller: UserContext | null,
    pickId: string,
    body: UpdatePickBody
  ): Promise<Result<PickView, UpdatePickServiceFailure>> {
    const existing = await this.deps.picks.findById(pickId);
    if (isErr(existing)) return existing;
    const held = existing.value;

    const videoId = body.videoId ?? held?.videoId;
    const video = videoId ? await this.deps.videos.findById(videoId) : ok(null);
    if (isErr(video)) return video;

    const patch = {
      videoId: body.videoId,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      note: body.note,
    };
    const overlapping = held
      ? await this.deps.picks.findOverlapping(
          { startsAt: patch.startsAt ?? held.startsAt, endsAt: patch.endsAt ?? held.endsAt },
          pickId
        )
      : ok(null);
    if (isErr(overlapping)) return overlapping;

    const decided = decidePickUpdate({
      actor: caller,
      pick: held,
      pickId,
      patch,
      video: video.value,
      now: new Date(this.deps.now()),
      overlapping: overlapping.value,
    });
    return andThenAsync(decided, async ({ pick, video: picked }) => {
      const written = await this.deps.picks.update(pick);
      return andThenAsync(
        written,
        async (found): Promise<Result<PickView, UpdatePickServiceFailure>> =>
          found ? this.committed(pick, picked) : err(pickNotFound(pickId))
      );
    });
  }

  async cancel(
    caller: UserContext | null,
    pickId: string
  ): Promise<Result<void, CancelPickServiceFailure>> {
    const existing = await this.deps.picks.findById(pickId);
    if (isErr(existing)) return existing;

    const decided = decidePickDelete({ actor: caller, pick: existing.value, pickId });
    return andThenAsync(decided, async ({ id }) => {
      const removed = await this.deps.picks.remove(id);
      if (isOk(removed)) await this.deps.currentCache.drop();
      return map(removed, () => undefined);
    });
  }

  private async resolve(at: number): Promise<Result<CurrentPickView, CurrentPickServiceFailure>> {
    const found = await this.deps.picks.findCurrent(new Date(at));
    if (isErr(found)) return found;

    const entry = found.value;
    if (entry && isOk(decidePickVideo(entry.video, entry.video.id))) {
      const view = toScheduledView(entry, this.deps.cdn, this.deps.sprite);
      await this.deps.currentCache.write(view, at);
      return ok(view);
    }
    return this.fallback();
  }

  private async fallback(): Promise<Result<CurrentPickView, CurrentPickServiceFailure>> {
    const trending = await this.deps.feed.getFeed({ sort: 'trending', limit: 1 });
    if (isErr(trending)) return trending;

    const [top] = trending.value.data.items;
    return top ? ok(toFallbackView(top)) : err(nothingToPick());
  }

  private page(data: CurrentPickView, at: number, ifNoneMatch?: string): CurrentPickPage {
    const { maxAgeSeconds, staleWhileRevalidateSeconds } = this.deps;
    const secondsLeft = data.endsAt ? Math.ceil((Date.parse(data.endsAt) - at) / 1000) : Infinity;
    // Keyed after the schema, because a cached read comes back in the schema's key order.
    const etag = generateEtag(CurrentPickSchema.parse(data));
    return {
      data,
      notModified: isNotModified(ifNoneMatch, etag),
      headers: buildCacheHeaders({
        etag,
        maxAgeSeconds: Math.min(maxAgeSeconds, secondsLeft),
        staleWhileRevalidateSeconds,
      }),
    };
  }

  private async committed(
    pick: EditorPick,
    video: Video
  ): Promise<Result<PickView, DatabaseUnavailable>> {
    await this.deps.currentCache.drop();
    const owner = await this.deps.channels.findByUserId(video.ownerId);
    return map(owner, (channel) =>
      toPickView(
        { pick, video, channel: channel && toChannelCard(channel) },
        this.deps.cdn,
        this.deps.sprite
      )
    );
  }
}
