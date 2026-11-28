/** What part of the video an item plays: all of it, from a point to the end, or a range. */
export type SegmentRange =
  | { kind: 'whole' }
  | { kind: 'from'; startMs: number }
  | { kind: 'range'; startMs: number; endMs: number };

/** An item's stored bounds as the range it plays; a missing start is the beginning. */
export function toSegmentRange(startMs: number | null, endMs: number | null): SegmentRange {
  if (endMs !== null) return { kind: 'range', startMs: startMs ?? 0, endMs };
  if (startMs !== null) return { kind: 'from', startMs };
  return { kind: 'whole' };
}
