import { SCREENING_SAMPLING, SCREENING_THRESHOLDS } from '../screening-tuning';

describe('packages/env-schema: screening tuning', () => {
  it.each([
    { name: 'a partial copy', lower: 'partialCoverage', upper: 'duplicateCoverage' },
    { name: 'a hold', lower: 'nsfwShareThreshold', upper: 'nsfwFrameThreshold' },
  ] as const)(
    'sets the bar for $name below the bar for the stronger finding',
    ({ lower, upper }) => {
      expect(SCREENING_THRESHOLDS[lower]).toBeLessThan(SCREENING_THRESHOLDS[upper]);
    }
  );

  it('keeps the audio index under 4000 rows for an hour of Chromaprint terms', () => {
    const termsPerHour = 3600 * 8.07;

    expect(termsPerHour / SCREENING_SAMPLING.audioIndexStride).toBeLessThan(4000);
  });
});
