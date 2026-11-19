import { isInputFailure } from '@kit/errors';
import { defineFieldFailures } from '../failures';

const { invalidField, invalidLength } = defineFieldFailures('BAD_INPUT');

describe('@kit/validation: defineFieldFailures', () => {
  it('builds a failure carrying the bound code and the field it rejected, wire-safe by construction', () => {
    const failure = invalidField('slug', 'bad slug', { maxLength: 100 });

    expect(failure).toEqual({
      code: 'BAD_INPUT',
      message: 'bad slug',
      field: 'slug',
      maxLength: 100,
    });
    expect(isInputFailure(failure)).toBe(true);
  });

  it('names the field and both bounds of a length', () => {
    expect(invalidLength('displayName', { minLength: 1, maxLength: 100 })).toEqual({
      code: 'BAD_INPUT',
      message: 'displayName must be between 1 and 100 characters',
      field: 'displayName',
      minLength: 1,
      maxLength: 100,
    });
  });
});
