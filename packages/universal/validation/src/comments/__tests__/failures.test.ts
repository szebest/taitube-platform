import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidCommentContent } from '../failures';

describe('@vp/validation: comment failures', () => {
  it('names the content field, carries VALIDATION_FAILED and is wire-safe', () => {
    const failure = invalidCommentContent({ minLength: 1, maxLength: 2000 });

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'content',
      maxLength: 2000,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
