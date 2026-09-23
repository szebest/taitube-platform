import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidVideoDescription, invalidVideoTitle } from '../failures';

describe('@vp/validation: video metadata failures', () => {
  it.each([
    {
      name: 'invalidVideoTitle',
      failure: invalidVideoTitle({ minLength: 1, maxLength: 200 }),
      field: 'title',
    },
    {
      name: 'invalidVideoDescription',
      failure: invalidVideoDescription(5000),
      field: 'description',
    },
  ])('$name names $field, carries VALIDATION_FAILED and is wire-safe', ({ failure, field }) => {
    expect(failure.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(failure.field).toBe(field);
    expect(isInputFailure(failure)).toBe(true);
  });

  it('reports the description ceiling so a form can show it', () => {
    expect(invalidVideoDescription(5000).maxLength).toBe(5000);
  });
});
