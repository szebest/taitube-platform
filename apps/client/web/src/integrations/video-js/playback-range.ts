import type { PlaybackRange } from '#app/lib/player/taitube-player-props';

const MS_PER_SECOND = 1000;
const SEEK_TOLERANCE_SECONDS = 0.5;

export function rangeStartSeconds(range: PlaybackRange): number {
  return range.startMs / MS_PER_SECOND;
}

export function isOutside(range: PlaybackRange, currentTime: number): boolean {
  const endSeconds = range.endMs / MS_PER_SECOND;
  return (
    currentTime >= endSeconds || currentTime < rangeStartSeconds(range) - SEEK_TOLERANCE_SECONDS
  );
}
