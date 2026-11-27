import type { TimelineRange } from '../types';

const MS_PER_SECOND = 1000;

/**
 * The range a drag of the two thumbs, in seconds, asks for, held to `maxSpanMs`: the thumb that did
 * not move gives way, so the one under the pointer never stops.
 */
export function clampRange(
  previous: TimelineRange,
  [startSeconds = 0, endSeconds = 0]: readonly number[],
  maxSpanMs: number
): TimelineRange {
  const startMs = startSeconds * MS_PER_SECOND;
  const endMs = endSeconds * MS_PER_SECOND;
  if (endMs - startMs <= maxSpanMs) return { startMs, endMs };

  return startMs !== previous.startMs
    ? { startMs, endMs: startMs + maxSpanMs }
    : { startMs: endMs - maxSpanMs, endMs };
}
