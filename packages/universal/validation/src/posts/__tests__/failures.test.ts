import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import {
  invalidPostCloseTime,
  invalidPostCorrectIndex,
  invalidPostImageCount,
  invalidPostOptionCount,
  invalidPostStartMs,
  invalidPostText,
} from '../failures';

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
      name: 'an option count',
      failure: invalidPostOptionCount({ minItems: 2, maxItems: 6 }),
      expected: { field: 'options', minItems: 2, maxItems: 6 },
    },
    {
      name: 'a correct index',
      failure: invalidPostCorrectIndex(4),
      expected: { field: 'correctIndex', min: 0, max: 3 },
    },
    {
      name: 'a close time',
      failure: invalidPostCloseTime(30),
      expected: { field: 'closesAt', min: 0, max: 30 },
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
