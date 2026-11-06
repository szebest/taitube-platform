import type { PlaybackRange } from './taitube-player-props';

const MS_PER_SECOND = 1000;

interface Playhead {
  currentTime: number;
  duration: number;
}

export function toClipPlayhead(
  range: PlaybackRange | undefined,
  { currentTime, duration }: Playhead
): Playhead {
  if (!range) {
    return { currentTime, duration };
  }

  const start = range.startMs / MS_PER_SECOND;
  const end =
    duration > 0 ? Math.min(range.endMs / MS_PER_SECOND, duration) : range.endMs / MS_PER_SECOND;
  const length = Math.max(end - start, 0);

  return { currentTime: Math.min(Math.max(currentTime - start, 0), length), duration: length };
}

export function fromClipTime(
  range: PlaybackRange | undefined,
  clipTime: number,
  duration: number
): number {
  if (!range) {
    return clipTime;
  }

  const start = range.startMs / MS_PER_SECOND;
  const length = toClipPlayhead(range, { currentTime: 0, duration }).duration;

  return start + Math.min(Math.max(clipTime, 0), length);
}
