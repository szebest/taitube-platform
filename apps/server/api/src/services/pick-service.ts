import type {
  CreatePickBody,
  ListPicksQuery,
  PickListView,
  PickView,
  UpdatePickBody,
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
  pickNotFound,
  type UpdatePickFailure,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { andThenAsync, err, isErr, isOk, map, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { CurrentPickCache } from './current-pick-cache';
import { toPickView } from './pick-views';
import type { SpriteGeometry } from './video-views';

export interface PickServiceDeps {
  picks: PickRepositoryPort;
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  currentCache: CurrentPickCache;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  defaultRangeMs: number;
  now: () => number;
}

export type ListPicksServiceFailure = AuthorizationFailure | DatabaseUnavailable;
export type CreatePickServiceFailure = CreatePickFailure | DatabaseUnavailable;
export type UpdatePickServiceFailure = UpdatePickFailure | DatabaseUnavailable;
export type CancelPickServiceFailure = DeletePickFailure | DatabaseUnavailable;

/**
 * Picks are written by admins and read by everyone. Every verdict comes from `@vp/domain-rules`;
 * the service reads what a rule needs, writes what it allowed and drops the cached current pick
 * after any write that committed.
 */
export class PickService {
  constructor(private readonly deps: PickServiceDeps) {}

  async list(
    caller: UserContext | null,
    query: ListPicksQuery
  ): Promise<Result<PickListView, ListPicksServiceFailure>> {
    const admin = decideAdminAccess(caller);
    if (isErr(admin)) return admin;

    const from = query.from ? new Date(query.from) : new Date(this.deps.now());
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + this.deps.defaultRangeMs);
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
