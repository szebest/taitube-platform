import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidField, invalidLength } from '../failures';

describe('@vp/validation: invalidField', () => {
  it('carries the generic validation code and the field it rejected', () => {
    expect(invalidField('slug', 'bad slug', { maxLength: 100 })).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: 'bad slug',
      field: 'slug',
      maxLength: 100,
    });
  });

  it('is wire-safe by construction', () => {
    expect(isInputFailure(invalidField('slug', 'bad slug', {}))).toBe(true);
  });
});

describe('@vp/validation: invalidLength', () => {
  it('names the field and both bounds in the message', () => {
    const failure = invalidLength('displayName', { minLength: 1, maxLength: 100 });

    expect(failure.message).toBe('displayName must be between 1 and 100 characters');
    expect(failure).toMatchObject({ field: 'displayName', minLength: 1, maxLength: 100 });
  });
});
