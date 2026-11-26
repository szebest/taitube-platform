import { type Result, err, ok } from '@kit/result';
import { normalizePlainText, withinLength } from '@kit/validation';
import {
  CHAPTER_MIN_GAP_MS,
  CHAPTER_TITLE_MAX_LENGTH,
  CHAPTERS_MAX_COUNT,
  CHAPTERS_MIN_COUNT,
  type Chapter,
} from '@vp/domain';
import { type InvalidChapters, invalidChapters } from './failures';

const TITLE_BOUNDS = { minLength: 1, maxLength: CHAPTER_TITLE_MAX_LENGTH };

function gapsFit(sorted: readonly Chapter[]): boolean {
  return sorted.every(
    (chapter, index) =>
      index === 0 || chapter.startMs - (sorted[index - 1]?.startMs ?? 0) >= CHAPTER_MIN_GAP_MS
  );
}

/** An empty set clears the chapters. Hands the set back sorted by time with its titles cleaned, so the caller stores what was checked. */
export function validateChapters(chapters: readonly Chapter[]): Result<Chapter[], InvalidChapters> {
  const cleaned = chapters
    .map(({ startMs, title }) => ({ startMs, title: normalizePlainText(title) }))
    .sort((a, b) => a.startMs - b.startMs);

  if (cleaned.length === 0) return ok(cleaned);
  if (cleaned.length < CHAPTERS_MIN_COUNT || cleaned.length > CHAPTERS_MAX_COUNT) {
    return err(
      invalidChapters(`A video has ${CHAPTERS_MIN_COUNT} to ${CHAPTERS_MAX_COUNT} chapters`)
    );
  }
  if (!cleaned.every(({ startMs }) => Number.isInteger(startMs) && startMs >= 0)) {
    return err(invalidChapters('A chapter starts at a whole number of milliseconds from 0'));
  }
  if (cleaned[0]?.startMs !== 0) return err(invalidChapters('The first chapter starts at 0'));
  if (!gapsFit(cleaned)) {
    return err(
      invalidChapters(`Chapters start at least ${CHAPTER_MIN_GAP_MS / 1000} seconds apart`)
    );
  }
  if (!cleaned.every(({ title }) => withinLength(title, TITLE_BOUNDS))) {
    return err(invalidChapters(`A chapter title is 1 to ${CHAPTER_TITLE_MAX_LENGTH} characters`));
  }
  return ok(cleaned);
}
