import { isErr, ok, type Result } from '@kit/result';
import { applyPlaybackCommand, type WatchPartyCloseReason, type WatchPartyRoom } from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import type { WatchPartyDeps } from './watch-party-deps';
import { logChange } from './watch-party-moderation-effects';
import { commitState } from './watch-party-playback';

/** A scheduled room nobody started within its grace closes as not started, whoever is waiting in it. */
/** @internal */
export function missedStart(
  room: Pick<WatchPartyRoom, 'scheduledFor' | 'startedAt' | 'phase'>,
  nowMs: number,
  graceMs: number
): boolean {
  return (
    room.scheduledFor !== null &&
    room.startedAt === null &&
    room.phase === 'lobby' &&
    nowMs >= room.scheduledFor.getTime() + graceMs
  );
}

/** An `auto_start` room at its time, still in the lobby: the room starts itself when anyone is present. */
/** @internal */
export function dueToAutoStart(
  room: Pick<WatchPartyRoom, 'scheduledFor' | 'autoStart' | 'phase'>,
  nowMs: number
): boolean {
  return (
    room.autoStart &&
    room.phase === 'lobby' &&
    room.scheduledFor !== null &&
    nowMs >= room.scheduledFor.getTime()
  );
}

type ScheduledDeps = Pick<
  WatchPartyDeps,
  | 'repositories'
  | 'broadcaster'
  | 'logger'
  | 'metrics'
  | 'config'
  | 'now'
  | 'secrets'
  | 'cdn'
  | 'gate'
>;

/**
 * What the sweep does with a scheduled room at its time: closes one nobody started within the
 * grace, and starts an `auto_start` lobby with someone present. `closed` when it closed the room.
 */
export async function startOrExpire(
  deps: ScheduledDeps,
  room: WatchPartyRoom,
  present: number,
  nowMs: number,
  close: (
    reason: WatchPartyCloseReason
  ) => Promise<Result<'kept' | 'closed', DatabaseUnavailable | CacheUnavailable>>
): Promise<Result<'kept' | 'closed', DatabaseUnavailable | CacheUnavailable>> {
  const { metrics, config, repositories, now } = deps;
  if (missedStart(room, nowMs, config.sweep.scheduledStartGraceMs)) {
    const closed = await close('not_started');
    if (isErr(closed)) return closed;
    if (closed.value === 'closed')
      metrics.watchPartyScheduledStartsTotal.inc({ outcome: 'expired' });
    return closed;
  }
  if (present === 0 || !dueToAutoStart(room, nowMs)) return ok('kept');

  const fresh = await repositories.watchPartyRooms.findById(room.id);
  if (isErr(fresh)) return fresh;
  if (fresh.value === null || fresh.value.phase !== 'lobby') return ok('kept');
  const started = await commitState(deps, fresh.value, {
    playback: applyPlaybackCommand(fresh.value.playback, { type: 'start' }, now().getTime()),
    by: null,
    reason: 'system',
  });
  if (isErr(started)) return started;
  if (started.value.type === 'applied') {
    metrics.watchPartyScheduledStartsTotal.inc({ outcome: 'started' });
    logChange(deps, { roomId: room.id, actorKey: 'system', action: 'start.auto' });
  }
  return ok('kept');
}
