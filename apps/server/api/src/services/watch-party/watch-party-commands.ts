import type { WatchPartyClientFrame, WatchPartyServerFrame } from '@vp/api-contracts';
import type { RoomWrite } from '@vp/core/repositories';
import {
  applyPlaybackCommand,
  isNearEnd,
  type PlaybackCommand,
  type WatchPartyPermission,
  type WatchPartyRoom,
} from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  type WatchPartyPermissionMissing,
  type WatchPartyStateStale,
  watchPartyNotFound,
  watchPartyStateStale,
} from '@vp/errors';
import { canInRoom } from '@vp/permissions';
import { assertNever, err, isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import { consumeBudget, type RateLimited } from './watch-party-budgets';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { advanceRoom, commitState, stateFrame } from './watch-party-playback';
import { loadSeated } from './watch-party-seated-actions';

export type CommandFrame = Extract<
  WatchPartyClientFrame,
  { type: 'play' | 'pause' | 'seek' | 'rate' | 'next' | 'start' | 'ended' }
>;

type Direct = (frame: WatchPartyServerFrame) => void;

export type CommandFailure =
  | WatchPartyNotFound
  | WatchPartyClosed
  | WatchPartyStateStale
  | WatchPartyPermissionMissing
  | RateLimited
  | CacheUnavailable
  | DatabaseUnavailable;

/**
 * The permission a command needs; `next` is also a skip, so `queue.skip` moves the room on too,
 * and any member may report the end.
 */
function authorizeCommand(
  context: RoomContext,
  frame: CommandFrame
): Result<WatchPartyPermission | null, WatchPartyPermissionMissing> {
  switch (frame.type) {
    case 'ended':
      return ok(null);
    case 'next':
      return canInRoom(context.ability, 'playback.control')
        ? ok('playback.control')
        : requireRoomPermission(context.ability, 'queue.skip');
    case 'play':
    case 'pause':
    case 'seek':
    case 'rate':
    case 'start':
      return requireRoomPermission(context.ability, 'playback.control');
    default:
      return assertNever(frame, 'CommandFrame');
  }
}

function clockCommand(frame: CommandFrame): PlaybackCommand | null {
  switch (frame.type) {
    case 'play':
      return { type: 'play' };
    case 'pause':
    case 'seek':
      return { type: frame.type, positionMs: frame.positionMs };
    case 'rate':
      return { type: 'rate', rate: frame.rate };
    case 'start':
      return { type: 'start' };
    case 'next':
    case 'ended':
      return null;
    default:
      return assertNever(frame, 'CommandFrame');
  }
}

/** `ended` moves the room only from the item it names and near that item's real end. */
async function endedAt(
  deps: Pick<WatchPartyDeps, 'repositories' | 'now'>,
  room: WatchPartyRoom,
  itemId: string
): Promise<Result<number | null, DatabaseUnavailable>> {
  if (room.playback.itemId !== itemId || room.currentVideoId === null) return ok(null);
  const video = await deps.repositories.videos.findById(room.currentVideoId);
  if (isErr(video)) return video;
  const durationMs = video.value?.durationMs ?? null;
  return ok(
    durationMs !== null && isNearEnd(room.playback, durationMs, deps.now().getTime())
      ? durationMs
      : null
  );
}

async function apply(
  deps: WatchPartyDeps,
  room: WatchPartyRoom,
  memberKey: string,
  frame: CommandFrame,
  skipping: boolean
): Promise<Result<RoomWrite | null, DatabaseUnavailable>> {
  const nowMs = deps.now().getTime();
  if (frame.type === 'next') {
    return advanceRoom(deps, room, memberKey, skipping ? 'skip' : 'command');
  }
  if (frame.type === 'ended') {
    const end = await endedAt(deps, room, frame.itemId);
    if (isErr(end)) return end;
    if (end.value === null) return ok(null);
    if (room.autoplay) return advanceRoom(deps, room, null, 'advance');
    return commitState(deps, room, {
      playback: { ...room.playback, phase: 'paused', positionMs: end.value, anchorAt: nowMs },
      by: null,
      reason: 'advance',
    });
  }
  const command = clockCommand(frame);
  const startable = room.phase === 'lobby' || room.phase === 'finished';
  if (command === null || (command.type === 'start') !== startable) return ok(null);
  return commitState(deps, room, {
    playback: applyPlaybackCommand(room.playback, command, nowMs),
    by: memberKey,
    reason: 'command',
  });
}

/**
 * A playback command against the versions its sender saw: a stale one is refused with the room's
 * current state sent to the sender first, so it re-applies on top before anything else is checked.
 */
export async function runCommand(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  frame: CommandFrame,
  direct: Direct
): Promise<Result<void, CommandFailure>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const { context, memberKey } = seated.value;
  const { room } = context;

  const spent = await consumeBudget(
    deps.gate,
    'command',
    `${roomId}:${memberKey}`,
    deps.config.budgets.command
  );
  if (isErr(spent)) return spent;

  if (frame.version !== room.playbackVersion || frame.rolesVersion !== room.rolesVersion) {
    direct(stateFrame(room, null, 'system'));
    return err(watchPartyStateStale(room.playbackVersion, room.rolesVersion));
  }
  const held = authorizeCommand(context, frame);
  if (isErr(held)) return held;

  const skipping = frame.type === 'next' && held.value === 'queue.skip';
  const written = await apply(deps, room, memberKey, frame, skipping);
  if (isErr(written)) return written;
  if (written.value?.type === 'missing') return err(watchPartyNotFound(roomId));
  if (written.value?.type === 'stale') {
    direct(stateFrame(written.value.room, null, 'system'));
    return err(
      watchPartyStateStale(written.value.room.playbackVersion, written.value.room.rolesVersion)
    );
  }
  return ok();
}
