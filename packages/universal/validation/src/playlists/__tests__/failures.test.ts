import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidPlaylistField } from '../failures';

describe('@vp/validation: playlist failures', () => {
  it('names the rejected field, carries VALIDATION_FAILED and is wire-safe', () => {
    const failure = invalidPlaylistField('title', { minLength: 1, maxLength: 150 });

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'title',
      maxLength: 150,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
