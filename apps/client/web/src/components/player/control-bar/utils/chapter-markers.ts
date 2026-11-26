import type { PlaybackRange, PlayerChapter } from '#app/lib/player/taitube-player-props';

const MS_PER_SECOND = 1000;

export interface ChapterMarker {
  startMs: number;
  title: string;
  /** Where the chapter starts along the seek bar, 0 to 100. */
  percent: number;
}

/**
 * The chapters that start after the beginning of what the seek bar shows, placed along it: a clip
 * shows only its own range, so a chapter outside it has no place.
 */
export function chapterMarkers(
  chapters: readonly PlayerChapter[],
  range: PlaybackRange | undefined,
  durationSeconds: number
): ChapterMarker[] {
  const startMs = range?.startMs ?? 0;
  const endMs = Math.min(range?.endMs ?? Infinity, durationSeconds * MS_PER_SECOND);
  const lengthMs = endMs - startMs;
  if (!(lengthMs > 0)) return [];

  return chapters
    .filter((chapter) => chapter.startMs > startMs && chapter.startMs < endMs)
    .map(({ startMs: at, title }) => ({
      startMs: at,
      title,
      percent: ((at - startMs) / lengthMs) * 100,
    }));
}

/** The chapter the playhead is in: the last one that has started. */
export function chapterAt(
  chapters: readonly PlayerChapter[],
  timeSeconds: number
): PlayerChapter | undefined {
  return chapters.findLast((chapter) => chapter.startMs <= timeSeconds * MS_PER_SECOND);
}
