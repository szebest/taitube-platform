import { CHAPTER_MIN_GAP_MS, CHAPTER_TITLE_MAX_LENGTH, CHAPTERS_MIN_COUNT } from '../chapters';

describe('@vp/domain: chapter limits', () => {
  it('needs three chapters ten seconds apart with titles up to sixty characters', () => {
    expect([CHAPTERS_MIN_COUNT, CHAPTER_MIN_GAP_MS, CHAPTER_TITLE_MAX_LENGTH]).toEqual([
      3, 10_000, 60,
    ]);
  });
});
