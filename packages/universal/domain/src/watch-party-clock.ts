import { MS_PER_SECOND } from './time';
import type { WatchPartyPhase } from './watch-party';

export const WATCH_PARTY_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type WatchPartyRate = (typeof WATCH_PARTY_RATES)[number];

const WATCH_PARTY_CLOCK = {
  /** Start puts the anchor this far ahead, so everyone sees the same countdown. */
  countdownMs: 3 * MS_PER_SECOND,
  pingIntervalMs: 30 * MS_PER_SECOND,
  /** NTP's minimum filter: the offset of the lowest round trip among the latest samples. */
  samples: 8,
  /** `ended` counts only this close to the item's duration. */
  endToleranceMs: 2 * MS_PER_SECOND,
} as const;

/**
 * The room clock. While `playing`, the position at server time `t` is
 * `positionMs + (t - anchorAt) * rate`; otherwise it is `positionMs`. `anchorAt` is epoch milliseconds.
 */
export interface WatchPartyPlayback {
  readonly itemId: string | null;
  readonly phase: WatchPartyPhase;
  readonly positionMs: number;
  readonly rate: WatchPartyRate;
  readonly anchorAt: number;
}

export function lobbyPlayback(itemId: string | null, startMs = 0): WatchPartyPlayback {
  return { itemId, phase: 'lobby', positionMs: startMs, rate: 1, anchorAt: 0 };
}

/** An anchor still in the future is a countdown: the position holds until it passes. */
export function expectedPositionMs(playback: WatchPartyPlayback, now: number): number {
  if (playback.phase !== 'playing') return playback.positionMs;
  return playback.positionMs + Math.max(0, now - playback.anchorAt) * playback.rate;
}

export type PlaybackCommand =
  | { readonly type: 'play' }
  | { readonly type: 'pause'; readonly positionMs: number }
  | { readonly type: 'seek'; readonly positionMs: number }
  | { readonly type: 'rate'; readonly rate: WatchPartyRate }
  | { readonly type: 'start' };

export function applyPlaybackCommand(
  playback: WatchPartyPlayback,
  command: PlaybackCommand,
  now: number
): WatchPartyPlayback {
  switch (command.type) {
    case 'play':
      return {
        ...playback,
        phase: 'playing',
        positionMs: expectedPositionMs(playback, now),
        anchorAt: now,
      };
    case 'pause':
      return { ...playback, phase: 'paused', positionMs: command.positionMs, anchorAt: now };
    case 'seek':
      return { ...playback, positionMs: command.positionMs, anchorAt: now };
    case 'rate':
      return {
        ...playback,
        positionMs: expectedPositionMs(playback, now),
        rate: command.rate,
        anchorAt: now,
      };
    case 'start':
      return { ...playback, phase: 'playing', anchorAt: now + WATCH_PARTY_CLOCK.countdownMs };
  }
}

/** The next item from its start, or `finished` when the queue ran out. */
export function advancePlayback(
  playback: WatchPartyPlayback,
  next: { readonly itemId: string; readonly startMs: number } | null,
  now: number
): WatchPartyPlayback {
  if (next === null) return { ...playback, phase: 'finished', anchorAt: now };
  return {
    ...playback,
    itemId: next.itemId,
    phase: 'playing',
    positionMs: next.startMs,
    anchorAt: now,
  };
}

/** Whether an `ended` report is the real end, rather than a client seeking to the last seconds early. */
export function isNearEnd(playback: WatchPartyPlayback, durationMs: number, now: number): boolean {
  return durationMs - expectedPositionMs(playback, now) <= WATCH_PARTY_CLOCK.endToleranceMs;
}

/** One ping: sent at `t0` and answered at `t1` on the client's clock, stamped `serverNow` on the server's. */
export interface ClockSample {
  readonly t0: number;
  readonly serverNow: number;
  readonly t1: number;
}

/** Server time minus client time, from the latest samples' fastest round trip; `null` before the first. */
export function clockOffsetMs(samples: readonly ClockSample[]): number | null {
  const fastest = samples
    .slice(-WATCH_PARTY_CLOCK.samples)
    .reduce<ClockSample | null>(
      (best, sample) =>
        best === null || sample.t1 - sample.t0 < best.t1 - best.t0 ? sample : best,
      null
    );
  if (fastest === null) return null;
  return fastest.serverNow - (fastest.t0 + fastest.t1) / 2;
}
