import type {
  addToWatchPartyQueue,
  moveWatchPartyQueueItem,
  PartyQueueView,
} from '@vp/api-contracts';
import type { QueueSnapshot, QueueWrite } from '@vp/core/repositories';
import { movePositions, WATCH_PARTY_LIMITS, type WatchPartyRoom } from '@vp/domain';
import { decideWatchPartyShareable, requireRoomPermission } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyNotFound,
  type WatchPartyQueueFull,
  type WatchPartyVideoNotShareable,
  watchPartyNotFound,
  watchPartyQueueFull,
  watchPartyVideoNotShareable,
} from '@vp/errors';
import { andThen, andThenAsync, assertNever, err, map, ok, type Result } from '@vp/result';
import type { z } from 'zod';
import type { PartyCaller } from './party-caller';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, logChange } from './watch-party-moderation-effects';
import { decideQueuePending, decideQueueRemove } from './watch-party-queue-rules';
import { presentQueue } from './watch-party-queue-views';
import { actingAsMember, seatedKeyOf } from './watch-party-seated-actions';

export type AddToQueueInput = z.output<typeof addToWatchPartyQueue.body>;
export type MoveQueueItemInput = z.output<typeof moveWatchPartyQueueItem.body>;

interface OneOfSources {
  readonly videoId?: string;
  readonly startMs?: number;
  readonly playlistId?: string;
}

interface Source {
  readonly videoId: string;
  readonly startMs: number;
}

type QueueEffect = 'queue.add' | 'queue.move' | 'queue.remove';

function appliedQueue(
  roomId: string
): (write: QueueWrite) => Result<QueueSnapshot, WatchPartyNotFound | WatchPartyQueueFull> {
  return (write) => {
    switch (write.type) {
      case 'applied':
        return ok(write.queue);
      case 'full':
        return err(watchPartyQueueFull(roomId));
      case 'missing':
        return err(watchPartyNotFound(roomId));
      default:
        return assertNever(write, 'queue write');
    }
  };
}

export class WatchPartyQueueService {
  constructor(private readonly deps: WatchPartyDeps) {}

  async list(
    roomId: string,
    caller: PartyCaller
  ): Promise<Result<PartyQueueView, WatchPartyNotFound | DatabaseUnavailable>> {
    const loaded = await this.deps.context.load(roomId, caller);
    return andThenAsync(loaded, (context) =>
      andThenAsync(seatedKeyOf(context), async () => {
        const snapshot = await this.deps.repositories.watchPartyQueue.list(roomId);
        return andThenAsync(snapshot, (current) => presentQueue(this.deps, current));
      })
    );
  }

  add(roomId: string, caller: PartyCaller, input: AddToQueueInput) {
    return this.editing(roomId, caller, async (context, memberKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'queue.add'), async () => {
        const sources = await this.sourcesOf(context.room, caller, input);
        return andThenAsync(sources, async (items) => {
          const pending = await this.deps.repositories.watchPartyQueue.countPendingBy(
            roomId,
            memberKey
          );
          return andThenAsync(pending, (count) =>
            andThenAsync(
              decideQueuePending({
                ability: context.ability,
                pending: count,
                adding: items.length,
              }),
              () => this.append(roomId, memberKey, items)
            )
          );
        });
      })
    );
  }

  move(roomId: string, caller: PartyCaller, itemId: string, { toIndex }: MoveQueueItemInput) {
    return this.editing(roomId, caller, (context, memberKey) =>
      andThenAsync(requireRoomPermission(context.ability, 'queue.reorder'), async () => {
        const { watchPartyQueue: queue } = this.deps.repositories;
        const snapshot = await queue.list(roomId);
        return andThenAsync(snapshot, async (current) => {
          const unplayed = current.items.filter(({ playedAt }) => playedAt === null);
          const writes = movePositions(unplayed, itemId, toIndex);
          if (writes === null) return err(watchPartyNotFound(roomId));
          if (writes.length === 0) return presentQueue(this.deps, current);
          return this.settle(roomId, memberKey, 'queue.move', await queue.move(roomId, writes));
        });
      })
    );
  }

  remove(roomId: string, caller: PartyCaller, itemId: string) {
    return this.editing(roomId, caller, async (context, memberKey) => {
      const { watchPartyQueue: queue } = this.deps.repositories;
      const snapshot = await queue.list(roomId);
      return andThenAsync(snapshot, (current) => {
        const item = current.items.find(({ id }) => id === itemId);
        if (item === undefined) return err(watchPartyNotFound(roomId));
        return andThenAsync(
          decideQueueRemove({ ability: context.ability, memberKey, item }),
          async () => {
            const removed = await queue.remove(roomId, itemId, null, this.deps.now());
            return map(
              await this.settle(roomId, memberKey, 'queue.remove', removed),
              () => undefined
            );
          }
        );
      });
    });
  }

  private editing<T, E>(
    roomId: string,
    caller: PartyCaller,
    act: (context: RoomContext, memberKey: string) => Promise<Result<T, E>>
  ) {
    return actingAsMember(this.deps.context, roomId, caller, act, watchPartyNotFound);
  }

  private async sourcesOf(
    room: WatchPartyRoom,
    caller: PartyCaller,
    input: AddToQueueInput
  ): Promise<Result<Source[], WatchPartyVideoNotShareable | DatabaseUnavailable>> {
    const { videoId, startMs, playlistId }: OneOfSources = input;
    const { videos, playlists } = this.deps.repositories;
    if (playlistId === undefined) {
      const id = videoId ?? '';
      const video = await videos.findById(id);
      return andThen(video, (found) =>
        map(decideWatchPartyShareable(id, found, room.visibility), () => [
          { videoId: id, startMs: startMs ?? 0 },
        ])
      );
    }
    const detail = await playlists.findDetail(playlistId, caller.user);
    return andThen(detail, (found) => {
      const kept = (found?.items ?? []).flatMap(({ videoId: id, video }) =>
        decideWatchPartyShareable(id, video, room.visibility).ok
          ? [{ videoId: id, startMs: 0 }]
          : []
      );
      return kept.length > 0 ? ok(kept) : err(watchPartyVideoNotShareable(playlistId, 'missing'));
    });
  }

  private async append(
    roomId: string,
    memberKey: string,
    sources: readonly Source[]
  ): Promise<
    Result<PartyQueueView, WatchPartyNotFound | WatchPartyQueueFull | DatabaseUnavailable>
  > {
    const createdAt = this.deps.now();
    const items = sources.map(({ videoId, startMs }) => ({
      id: this.deps.secrets.newId(),
      roomId,
      videoId,
      addedBy: memberKey,
      startMs,
      createdAt,
    }));
    const written = await this.deps.repositories.watchPartyQueue.append(
      roomId,
      items,
      WATCH_PARTY_LIMITS.queueItems
    );
    return this.settle(roomId, memberKey, 'queue.add', written);
  }

  private settle(
    roomId: string,
    memberKey: string,
    action: QueueEffect,
    written: Result<QueueWrite, DatabaseUnavailable>
  ) {
    return andThenAsync(andThen(written, appliedQueue(roomId)), (snapshot) =>
      this.publish(roomId, memberKey, action, snapshot)
    );
  }

  private async publish(
    roomId: string,
    memberKey: string,
    action: QueueEffect,
    snapshot: QueueSnapshot
  ): Promise<Result<PartyQueueView, DatabaseUnavailable>> {
    const view = await presentQueue(this.deps, snapshot);
    if (view.ok) await announce(this.deps, roomId, { type: 'queue', ...view.value });
    logChange(this.deps, { roomId, actorKey: memberKey, action });
    return view;
  }
}
