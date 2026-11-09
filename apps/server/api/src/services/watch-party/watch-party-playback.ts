import type { WatchPartyServerFrame } from '@vp/api-contracts';
import type { NewSystemLine, RoomWrite } from '@vp/core/repositories';
import {
  advancePlayback,
  expectedPositionMs,
  type WatchPartyPlayback,
  type WatchPartyRoom,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, announceLine } from './watch-party-moderation-effects';
import { presentQueue } from './watch-party-queue-views';

type PlaybackDeps = Pick<
  WatchPartyDeps,
  'repositories' | 'broadcaster' | 'logger' | 'now' | 'secrets' | 'cdn' | 'gate'
>;

type StateReason = Extract<WatchPartyServerFrame, { type: 'state' }>['reason'];

export interface StateChange {
  readonly playback: WatchPartyPlayback;
  /** The member who acted; `null` when the room itself did. */
  readonly by: string | null;
  readonly reason: StateReason;
  readonly playedItemId?: string;
  readonly currentVideoId?: string | null;
  readonly line?: NewSystemLine | null;
}

export function stateFrame(
  room: Pick<WatchPartyRoom, 'playback' | 'playbackVersion'>,
  by: string | null,
  reason: StateReason
): WatchPartyServerFrame {
  return { type: 'state', playback: room.playback, version: room.playbackVersion, by, reason };
}

/**
 * One compare-and-set on the versions `room` was read at; an applied change goes out to every
 * socket as `state`, and a start with its countdown.
 */
export async function commitState(
  deps: PlaybackDeps,
  room: WatchPartyRoom,
  change: StateChange
): Promise<Result<RoomWrite, DatabaseUnavailable>> {
  const { playback, by, reason, playedItemId, currentVideoId, line } = change;
  const at = deps.now();
  const written = await deps.repositories.watchPartyRooms.commitPlayback(room.id, {
    expected: { playbackVersion: room.playbackVersion, rolesVersion: room.rolesVersion },
    playback,
    ...(playedItemId === undefined ? {} : { playedItemId }),
    ...(currentVideoId === undefined ? {} : { currentVideoId }),
    line: line ?? null,
    at,
  });
  if (isErr(written) || written.value.type !== 'applied') return written;

  const committed = written.value.room;
  await announce(deps, room.id, stateFrame(committed, by, reason));
  if (line) await announceLine(deps, room.id, line);
  if (committed.phase === 'playing' && committed.playback.anchorAt > at.getTime()) {
    await announce(deps, room.id, { type: 'countdown', startsAt: committed.playback.anchorAt });
  }
  return written;
}

/**
 * Moves the room off its current item to the next unplayed one, or to `finished` when none is
 * left, with a "now playing" line, the queue as it now stands, and the item's skip votes cleared.
 */
export async function advanceRoom(
  deps: PlaybackDeps,
  room: WatchPartyRoom,
  by: string | null,
  reason: StateReason
): Promise<Result<RoomWrite, DatabaseUnavailable>> {
  const { repositories, now } = deps;
  const queue = await repositories.watchPartyQueue.list(room.id);
  if (isErr(queue)) return queue;

  const { items } = queue.value;
  const current = room.playback.itemId;
  const from = items.findIndex(({ id }) => id === current);
  const next = items
    .slice(from + 1)
    .find(({ playedAt, id }) => playedAt === null && id !== current);
  const at = now();
  const written = await commitState(deps, room, {
    playback: advancePlayback(
      room.playback,
      next === undefined ? null : { itemId: next.id, startMs: next.startMs },
      at.getTime()
    ),
    by,
    reason,
    ...(current === null ? {} : { playedItemId: current }),
    ...(next === undefined ? {} : { currentVideoId: next.videoId }),
    line:
      next === undefined
        ? null
        : {
            id: deps.secrets.newId(),
            line: { event: 'now_playing', actorKey: by, targetKey: null, detail: next.videoId },
            videoId: next.videoId,
            positionMs: next.startMs,
            createdAt: at,
          },
  });
  if (isErr(written) || written.value.type !== 'applied') return written;

  if (current !== null) {
    const cleared = await deps.gate.clearSkipVotes(room.id, current);
    if (isErr(cleared)) deps.logger.warn({ err: cleared.error, roomId: room.id }, 'votes kept');
  }
  const after = await repositories.watchPartyQueue.list(room.id);
  const view = isErr(after) ? after : await presentQueue(deps, after.value);
  if (!isErr(view)) await announce(deps, room.id, { type: 'queue', ...view.value });
  return written;
}

/** Holds the room where it is now, as the system: the buffering wait's pause. */
export function pausedNow(room: WatchPartyRoom, nowMs: number): WatchPartyPlayback {
  return {
    ...room.playback,
    phase: 'paused',
    positionMs: Math.round(expectedPositionMs(room.playback, nowMs)),
    anchorAt: nowMs,
  };
}
