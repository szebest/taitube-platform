import { durationBucket } from '../duration-bucket';

describe('apps/worker/stages: durationBucket', () => {
  it.each([
    [0, '<1min'],
    [59_999, '<1min'],
    [60_000, '1-5'],
    [300_000, '5-15'],
    [900_000, '15-60'],
    [3_600_000, '15-60'],
  ])('bands a %i ms source as %s', (durationMs, bucket) => {
    expect(durationBucket(durationMs)).toBe(bucket);
  });
});
