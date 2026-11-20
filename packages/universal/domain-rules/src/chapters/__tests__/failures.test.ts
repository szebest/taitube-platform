import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidChapters } from '../failures';

describe('@vp/domain-rules: chapter failures', () => {
  it('names the chapters field with the limits and is wire-safe', () => {
    const failure = invalidChapters('too few');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'chapters',
      message: 'too few',
      minCount: 3,
      maxCount: 50,
      minGapMs: 10_000,
      maxTitleLength: 60,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
