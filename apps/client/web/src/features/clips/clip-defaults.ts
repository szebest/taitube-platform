import type { PlaybackRange } from '#app/features/player';

const DEFAULT_CLIP_MS = 20_000;

const MS_PER_SECOND = 1000;

/** Twenty seconds from the playhead, pulled back to end inside a video that ends sooner. */
export function initialClipRange(playheadSeconds: number, durationMs: number): PlaybackRange {
  const whole = Math.floor(durationMs / MS_PER_SECOND) * MS_PER_SECOND;
  const length = Math.min(DEFAULT_CLIP_MS, whole);
  const startMs = Math.min(Math.floor(playheadSeconds) * MS_PER_SECOND, whole - length);

  return { startMs, endMs: startMs + length };
}
