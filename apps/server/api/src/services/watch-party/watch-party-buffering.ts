import { applyPlaybackCommand } from '@vp/domain';
import { isErr, ok } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { commitState, pausedNow } from './watch-party-playback';

type BufferingDeps = Pick<
  WatchPartyDeps,
  | 'repositories'
  | 'presence'
  | 'broadcaster'
  | 'logger'
  | 'config'
  | 'now'
  | 'secrets'
  | 'cdn'
  | 'gate'
>;

interface RoomWait {
  readonly stalls: Map<string, ReturnType<typeof setTimeout>>;
  /** The playback version this pod's pause wrote, and the timer that gives up waiting. */
  paused: { readonly version: number; readonly giveUp: ReturnType<typeof setTimeout> } | null;
}

/**
 * The `wait` buffer policy for the members whose sockets this pod holds: one buffering past the
 * threshold pauses a small room as the system, and the room plays on once none of them buffers or
 * the wait runs out, whichever comes first. A guest never pauses the room.
 */
export class BufferingWait {
  private readonly rooms = new Map<string, RoomWait>();

  constructor(private readonly deps: BufferingDeps) {}

  start(roomId: string, memberKey: string): void {
    const wait = this.waitOf(roomId);
    if (wait.stalls.has(memberKey)) return;
    wait.stalls.set(
      memberKey,
      setTimeout(() => void this.report(this.stall(roomId)), this.deps.config.buffering.waitAfterMs)
    );
  }

  stop(roomId: string, memberKey: string): void {
    const wait = this.rooms.get(roomId);
    if (!wait) return;
    clearTimeout(wait.stalls.get(memberKey));
    wait.stalls.delete(memberKey);
    if (wait.stalls.size === 0 && wait.paused !== null) void this.report(this.resume(roomId));
    else if (wait.stalls.size === 0) this.rooms.delete(roomId);
  }

  close(): void {
    for (const wait of this.rooms.values()) {
      for (const timer of wait.stalls.values()) clearTimeout(timer);
      clearTimeout(wait.paused?.giveUp);
    }
    this.rooms.clear();
  }

  private waitOf(roomId: string): RoomWait {
    const known = this.rooms.get(roomId);
    if (known) return known;
    const created: RoomWait = { stalls: new Map(), paused: null };
    this.rooms.set(roomId, created);
    return created;
  }

  private async stall(roomId: string) {
    const { repositories, presence, config, now } = this.deps;
    const wait = this.rooms.get(roomId);
    if (!wait || wait.paused !== null) return ok();
    const found = await repositories.watchPartyRooms.findById(roomId);
    if (isErr(found)) return found;
    const room = found.value;
    if (room === null || room.bufferPolicy !== 'wait' || room.phase !== 'playing') return ok();
    const at = now().getTime();
    const present = await presence.members(roomId, at - config.presence.staleAfterMs);
    if (isErr(present)) return present;
    if (present.value.length > config.buffering.maxRoomSize) return ok();

    const written = await commitState(this.deps, room, {
      playback: pausedNow(room, at),
      by: null,
      reason: 'buffering',
    });
    if (isErr(written) || written.value.type !== 'applied') return written;
    wait.paused = {
      version: written.value.room.playbackVersion,
      giveUp: setTimeout(() => void this.report(this.resume(roomId)), config.buffering.maxWaitMs),
    };
    return ok();
  }

  /** Plays on only from the pause this pod wrote: anyone who moved the room since has the say. */
  private async resume(roomId: string) {
    const wait = this.rooms.get(roomId);
    const paused = wait?.paused;
    if (!wait || !paused) return ok();
    clearTimeout(paused.giveUp);
    wait.paused = null;
    if (wait.stalls.size === 0) this.rooms.delete(roomId);

    const found = await this.deps.repositories.watchPartyRooms.findById(roomId);
    if (isErr(found)) return found;
    const room = found.value;
    if (room === null || room.playbackVersion !== paused.version) return ok();
    const written = await commitState(this.deps, room, {
      playback: applyPlaybackCommand(room.playback, { type: 'play' }, this.deps.now().getTime()),
      by: null,
      reason: 'buffering',
    });
    return isErr(written) ? written : ok();
  }

  private async report(done: ReturnType<BufferingWait['stall']>): Promise<void> {
    const outcome = await done;
    if (!outcome.ok) {
      this.deps.logger.warn({ err: outcome.error }, 'buffering wait not applied');
    }
  }
}
