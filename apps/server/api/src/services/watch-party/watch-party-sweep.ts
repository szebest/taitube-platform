import { MS_PER_DAY, MS_PER_SECOND } from '@kit/primitives';
import { isErr, ok, type Result } from '@kit/result';
import {
  applyPlaybackCommand,
  IDLE_CLOSE_MS,
  type WatchPartyCloseReason,
  type WatchPartyRoom,
} from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { dropUnavailable } from './watch-party-availability';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, logChange } from './watch-party-moderation-effects';
import { handOverAbsentOwner } from './watch-party-owner-grace';
import { advanceRoom, announceQueue, commitState } from './watch-party-playback';
import { addToTally, emptyTally, publishTally, type SweepTally } from './watch-party-sweep-gauges';

type SweepDeps = Pick<
  WatchPartyDeps,
  | 'repositories'
  | 'presence'
  | 'broadcaster'
  | 'logger'
  | 'metrics'
  | 'config'
  | 'now'
  | 'secrets'
  | 'cdn'
  | 'gate'
>;

type SweepFailure = DatabaseUnavailable | CacheUnavailable;

export interface SweepOutcome {
  readonly rooms: number;
  readonly closed: number;
  readonly handedOver: number;
  readonly purgedRooms: number;
  readonly purgedMessages: number;
}

type IdleView = Pick<
  WatchPartyRoom,
  'idleClose' | 'scheduledFor' | 'lastPresentAt' | 'createdAt' | 'startedAt'
>;

/** The reason an open room with nobody present closes now, or `null` while it may stay. */
/** @internal */
export function idleCloseReason(
  room: IdleView,
  nowMs: number,
  scheduledStartGraceMs: number
): WatchPartyCloseReason | null {
  const allowed = IDLE_CLOSE_MS[room.idleClose];
  if (allowed === null) return null;
  if (room.scheduledFor !== null && nowMs < room.scheduledFor.getTime() + scheduledStartGraceMs) {
    return null;
  }
  const lastSeenAt = (room.lastPresentAt ?? room.createdAt).getTime();
  if (nowMs - lastSeenAt < allowed) return null;
  return room.startedAt === null ? 'not_started' : 'idle';
}

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

/**
 * Once a minute, on every pod and safe to repeat because each write is a compare-and-set: counts who
 * is present, closes rooms nobody has been in for their idle time, passes ownership on from an
 * owner who stayed away past the grace (a pod that died mid-grace never ran its timer), and drops
 * what closed rooms and old chat lines no longer need.
 */
export class WatchPartySweep {
  private readonly ownerAbsentSince = new Map<string, number>();

  constructor(private readonly deps: SweepDeps) {}

  async run(): Promise<Result<SweepOutcome, SweepFailure>> {
    const { repositories, config, now } = this.deps;
    const at = now();
    const totals = { rooms: 0, closed: 0, handedOver: 0 };
    const gauges = emptyTally();
    let afterId: string | null = null;
    const seen = new Set<string>();

    const skewed = await this.readSkew(at);
    if (isErr(skewed)) return skewed;

    for (;;) {
      const page = await repositories.watchPartyHousekeeping.listOpen(
        afterId,
        config.sweep.batchSize
      );
      if (isErr(page)) return page;
      for (const room of page.value) {
        seen.add(room.id);
        const swept = await this.sweepRoom(room, at, gauges);
        if (isErr(swept)) {
          this.deps.logger.warn({ err: swept.error, roomId: room.id }, 'room not swept');
          continue;
        }
        totals.rooms += 1;
        totals.closed += swept.value === 'closed' ? 1 : 0;
        totals.handedOver += swept.value === 'handed over' ? 1 : 0;
      }
      afterId = page.value.at(-1)?.id ?? null;
      if (page.value.length < config.sweep.batchSize || afterId === null) break;
    }
    publishTally(gauges, this.deps.metrics);
    for (const roomId of this.ownerAbsentSince.keys()) {
      if (!seen.has(roomId)) this.ownerAbsentSince.delete(roomId);
    }

    const purged = await this.purge(at);
    if (isErr(purged)) return purged;
    return ok({ ...totals, ...purged.value });
  }

  private async readSkew(at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const clock = await this.deps.repositories.watchPartyHousekeeping.databaseClock();
    if (isErr(clock)) return clock;
    this.deps.metrics.watchPartyClockSkewSeconds.set(
      (at.getTime() - clock.value.getTime()) / MS_PER_SECOND
    );
    return ok();
  }

  private async sweepRoom(
    room: WatchPartyRoom,
    at: Date,
    gauges: SweepTally
  ): Promise<Result<'kept' | 'closed' | 'handed over', SweepFailure>> {
    const { presence, repositories, config } = this.deps;
    const nowMs = at.getTime();
    const present = await presence.members(room.id, nowMs - config.presence.staleAfterMs);
    if (isErr(present)) return present;
    const recorded = await repositories.watchPartyRooms.recordPresence(
      room.id,
      present.value.length,
      at
    );
    if (isErr(recorded)) return recorded;
    addToTally(gauges, room, present.value);

    const available = await this.skipUnavailable(room);
    if (isErr(available)) return available;

    const nowRoom = await this.startOrExpire(room, present.value.length, nowMs);
    if (isErr(nowRoom)) return nowRoom;
    if (nowRoom.value === 'closed') return ok('closed');

    if (present.value.length === 0) {
      this.ownerAbsentSince.delete(room.id);
      return this.closeIfIdle(room, nowMs);
    }
    if (present.value.some(({ memberKey }) => memberKey === room.ownerKey)) {
      this.ownerAbsentSince.delete(room.id);
      return ok('kept');
    }
    return this.handOverIfAbsent(room.id, nowMs);
  }

  private async startOrExpire(
    room: WatchPartyRoom,
    present: number,
    nowMs: number
  ): Promise<Result<'kept' | 'closed', SweepFailure>> {
    const { metrics, config, repositories, now } = this.deps;
    if (missedStart(room, nowMs, config.sweep.scheduledStartGraceMs)) {
      const closed = await this.close(room.id, 'not_started');
      if (isErr(closed)) return closed;
      if (closed.value === 'closed')
        metrics.watchPartyScheduledStartsTotal.inc({ outcome: 'expired' });
      return closed;
    }
    if (present === 0 || !dueToAutoStart(room, nowMs)) return ok('kept');

    const fresh = await repositories.watchPartyRooms.findById(room.id);
    if (isErr(fresh)) return fresh;
    if (
      fresh.value === null ||
      fresh.value.phase !== 'lobby' ||
      fresh.value.playback.itemId === null
    ) {
      return ok('kept');
    }
    const started = await commitState(this.deps, fresh.value, {
      playback: applyPlaybackCommand(fresh.value.playback, { type: 'start' }, now().getTime()),
      by: null,
      reason: 'system',
    });
    if (isErr(started)) return started;
    if (started.value.type === 'applied') {
      metrics.watchPartyScheduledStartsTotal.inc({ outcome: 'started' });
      logChange(this.deps, { roomId: room.id, actorKey: 'system', action: 'start.auto' });
    }
    return ok('kept');
  }

  private async skipUnavailable(room: WatchPartyRoom): Promise<Result<void, DatabaseUnavailable>> {
    const checked = await dropUnavailable(this.deps, room);
    if (isErr(checked)) return checked;

    const { queue, removed } = checked.value;
    const { itemId } = room.playback;
    const lostCurrent =
      itemId !== null && room.phase !== 'finished' && !queue.items.some(({ id }) => id === itemId);
    if (lostCurrent) {
      const advanced = await advanceRoom(this.deps, room, null, 'system');
      return isErr(advanced) ? advanced : ok();
    }
    if (removed > 0) await announceQueue(this.deps, room.id, queue);
    return ok();
  }

  private async closeIfIdle(
    room: WatchPartyRoom,
    nowMs: number
  ): Promise<Result<'kept' | 'closed', SweepFailure>> {
    const reason = idleCloseReason(room, nowMs, this.deps.config.sweep.scheduledStartGraceMs);
    return reason === null ? ok('kept') : this.close(room.id, reason);
  }

  private async close(
    roomId: string,
    reason: WatchPartyCloseReason
  ): Promise<Result<'kept' | 'closed', SweepFailure>> {
    const written = await this.deps.repositories.watchPartyRooms.close(
      roomId,
      reason,
      null,
      this.deps.now()
    );
    if (isErr(written)) return written;
    if (written.value.type !== 'applied') return ok('kept');
    logChange(this.deps, { roomId, actorKey: 'system', action: `close.${reason}` });
    await announce(this.deps, roomId, { type: 'closed', reason });
    return ok('closed');
  }

  private async handOverIfAbsent(
    roomId: string,
    nowMs: number
  ): Promise<Result<'kept' | 'handed over', SweepFailure>> {
    const since = this.ownerAbsentSince.get(roomId) ?? nowMs;
    this.ownerAbsentSince.set(roomId, since);
    if (nowMs - since < this.deps.config.ownerGraceMs) return ok('kept');
    const handed = await handOverAbsentOwner(this.deps, roomId);
    if (isErr(handed)) return handed;
    if (handed.value === 'waiting') return ok('kept');
    this.ownerAbsentSince.delete(roomId);
    return ok(handed.value === 'transferred' ? 'handed over' : 'kept');
  }

  private async purge(
    at: Date
  ): Promise<Result<{ purgedRooms: number; purgedMessages: number }, DatabaseUnavailable>> {
    const { repositories, config } = this.deps;
    const days = (count: number) => new Date(at.getTime() - count * MS_PER_DAY);
    const rooms = await repositories.watchPartyHousekeeping.purgeClosedBefore(
      days(config.closedRoomRetentionDays)
    );
    if (isErr(rooms)) return rooms;
    const messages = await repositories.watchPartyHousekeeping.purgeMessagesBefore(
      days(config.messageRetentionDays)
    );
    if (isErr(messages)) return messages;
    return ok({ purgedRooms: rooms.value, purgedMessages: messages.value });
  }
}
