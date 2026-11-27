import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { invalidPostImageCount, invalidPostStartMs, invalidPostText } from '../failures';

describe('@vp/validation: post failures', () => {
  it.each([
    {
      name: 'a text length',
      failure: invalidPostText('text', { minLength: 1, maxLength: 2000 }),
      expected: { field: 'text', minLength: 1, maxLength: 2000 },
    },
    {
      name: 'an image count',
      failure: invalidPostImageCount({ minItems: 1, maxItems: 4 }),
      expected: { field: 'images', minItems: 1, maxItems: 4 },
    },
    {
      name: 'a start offset',
      failure: invalidPostStartMs(),
      expected: { field: 'startMs', min: 0 },
    },
  ])(
    'names the field of $name, carries VALIDATION_FAILED and is wire-safe',
    ({ failure, expected }) => {
      expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, ...expected });
      expect(isInputFailure(failure)).toBe(true);
    }
  );
});
