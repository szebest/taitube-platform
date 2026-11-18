import {
  CHAPTER_MIN_GAP_MS,
  CHAPTER_TITLE_MAX_LENGTH,
  CHAPTERS_MAX_COUNT,
  CHAPTERS_MIN_COUNT,
} from '@vp/domain';
import { type InvalidField, invalidField } from '@vp/validation';

interface ChapterLimits {
  readonly minCount: number;
  readonly maxCount: number;
  readonly minGapMs: number;
  readonly maxTitleLength: number;
}

export type InvalidChapters = InvalidField<ChapterLimits>;

export function invalidChapters(reason: string): InvalidChapters {
  return invalidField('chapters', reason, {
    minCount: CHAPTERS_MIN_COUNT,
    maxCount: CHAPTERS_MAX_COUNT,
    minGapMs: CHAPTER_MIN_GAP_MS,
    maxTitleLength: CHAPTER_TITLE_MAX_LENGTH,
  });
}
