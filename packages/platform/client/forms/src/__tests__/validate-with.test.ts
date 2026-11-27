import { CommonErrorCodes } from '@kit/errors';
import { err, ok } from '@kit/result';
import { defineFieldFailures, withinLength } from '@kit/validation';
import { validateWith } from '../validate-with';

const { invalidLength } = defineFieldFailures(CommonErrorCodes.VALIDATION_FAILED);
const TITLE = { minLength: 1, maxLength: 5 };

const validateTitle = validateWith((title: string) =>
  withinLength(title, TITLE) ? ok(title) : err(invalidLength('title', TITLE))
);

describe('@kit/forms: validateWith', () => {
  it('passes a value the rule accepts', () => {
    expect(validateTitle({ value: 'Hello' })).toBeUndefined();
  });

  it("answers a value the rule refuses with the rule's message", () => {
    expect(validateTitle({ value: '' })).toBe('title must be between 1 and 5 characters');
  });
});
