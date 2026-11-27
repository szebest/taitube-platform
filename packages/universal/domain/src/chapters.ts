export const CHAPTERS_MIN_COUNT = 3;
export const CHAPTERS_MAX_COUNT = 50;
export const CHAPTER_MIN_GAP_MS = 10_000;
export const CHAPTER_TITLE_MAX_LENGTH = 60;

export interface Chapter {
  startMs: number;
  title: string;
}
