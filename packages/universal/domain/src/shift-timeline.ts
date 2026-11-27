import { CHAPTER_MIN_GAP_MS, CHAPTERS_MIN_COUNT, type Chapter } from './chapters';
import { CORRECTION_MIN_MS } from './corrections';
import type { TimeRange } from './video-edits';
import type { GenerationTimeline, TimedCorrection } from './video-generations';

function shiftChapters(chapters: readonly Chapter[], trim: TimeRange): Chapter[] {
  const sorted = chapters.toSorted((a, b) => a.startMs - b.startMs);
  const kept = sorted.filter(
    (chapter, index) =>
      chapter.startMs < trim.endMs &&
      (chapter.startMs >= trim.startMs || (sorted[index + 1]?.startMs ?? trim.endMs) > trim.startMs)
  );
  const shifted: Chapter[] = [];
  for (const chapter of kept) {
    const startMs = Math.max(0, chapter.startMs - trim.startMs);
    const previous = shifted.at(-1);
    if (!previous || startMs - previous.startMs >= CHAPTER_MIN_GAP_MS) {
      shifted.push({ ...chapter, startMs });
    }
  }
  return shifted.length >= CHAPTERS_MIN_COUNT ? shifted : [];
}

function shiftCorrections(
  corrections: readonly TimedCorrection[],
  trim: TimeRange
): TimedCorrection[] {
  return corrections
    .map((correction) => ({
      ...correction,
      startMs: Math.max(correction.startMs, trim.startMs) - trim.startMs,
      endMs: Math.min(correction.endMs, trim.endMs) - trim.startMs,
    }))
    .filter(({ startMs, endMs }) => endMs - startMs >= CORRECTION_MIN_MS);
}

/**
 * Moves a base generation's chapters and corrections onto the trimmed timeline. The chapter the trim
 * starts in opens the video at zero, anything past the trim's end is cut, and a correction keeps only
 * what is left of it inside the trim. A chapter pushed closer to the one before it than the chapter rule's
 * gap is dropped, and so are all of them when fewer than the rule's minimum are left.
 */
export function shiftTimeline(
  timeline: GenerationTimeline,
  trim: TimeRange | null
): GenerationTimeline {
  if (!trim) return timeline;
  return {
    chapters: shiftChapters(timeline.chapters, trim),
    corrections: shiftCorrections(timeline.corrections, trim),
  };
}
