import { ErrorCodes, isInputFailure } from '@vp/errors';
import { clipNotFound, invalidClipRange } from '../failures';

describe('@vp/domain-rules: clip failures', () => {
  it('names the missing clip', () => {
    expect(clipNotFound('c1')).toMatchObject({ code: ErrorCodes.CLIP_NOT_FOUND, clipId: 'c1' });
  });

  it('names the range field with the bounds and is wire-safe', () => {
    const failure = invalidClipRange(90_000);

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'range',
      minMs: 5_000,
      maxMs: 60_000,
      videoDurationMs: 90_000,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
