import type { PlaybackRange } from './taitube-player-props';

const MS_PER_SECOND = 1000;

export interface BarSpan {
  startMs: number;
  endMs: number;
}

/** What the seek bar shows of the video: the clip's range, or the whole of it; `undefined` until the length is known. */
export function barSpan(
  range: PlaybackRange | undefined,
  durationSeconds: number
): BarSpan | undefined {
  const startMs = range?.startMs ?? 0;
  const endMs = Math.min(range?.endMs ?? Infinity, durationSeconds * MS_PER_SECOND);

  return endMs > startMs ? { startMs, endMs } : undefined;
}

/** Where a moment of the video falls along the bar, 0 to 100, or `undefined` outside what the bar shows. */
export function barPercent(atMs: number, { startMs, endMs }: BarSpan): number | undefined {
  return atMs >= startMs && atMs < endMs ? ((atMs - startMs) / (endMs - startMs)) * 100 : undefined;
}
