import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateClipRange } from '../clip-range.rule';

const DURATION = 120_000;

describe('@vp/domain-rules: validateClipRange', () => {
  it.each([
    { name: 'the shortest clip', startMs: 0, endMs: 5_000 },
    { name: 'the longest clip', startMs: 10_000, endMs: 70_000 },
    { name: 'a clip ending with the video', startMs: 100_000, endMs: DURATION },
    { name: 'a clip mid-video', startMs: 31_250, endMs: 51_250 },
  ])('accepts $name', (range) => {
    expect(expectOk(validateClipRange(range, DURATION))).toEqual(range);
  });

  it.each([
    { name: 'a clip under five seconds', startMs: 0, endMs: 4_999 },
    { name: 'a clip over sixty seconds', startMs: 0, endMs: 60_001 },
    { name: 'a negative start', startMs: -1, endMs: 5_000 },
    { name: 'an end past the video', startMs: 100_000, endMs: DURATION + 1 },
    { name: 'a zero-length clip', startMs: 10_000, endMs: 10_000 },
    { name: 'an end before the start', startMs: 30_000, endMs: 10_000 },
  ])('rejects $name', (range) => {
    expect(expectErr(validateClipRange(range, DURATION))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'range',
      videoDurationMs: DURATION,
    });
  });
});
