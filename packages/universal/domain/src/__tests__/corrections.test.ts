import {
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  MAX_CORRECTIONS_PER_VIDEO,
} from '../corrections';

describe('@vp/domain: correction limits', () => {
  it('allows two to thirty seconds, 200 characters and ten per video', () => {
    expect([
      CORRECTION_MIN_MS,
      CORRECTION_MAX_MS,
      CORRECTION_TEXT_MAX_LENGTH,
      MAX_CORRECTIONS_PER_VIDEO,
    ]).toEqual([2_000, 30_000, 200, 10]);
  });
});
