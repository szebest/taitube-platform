import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateChatMessage } from '../chat-message';

describe('@vp/validation: validateChatMessage', () => {
  it.each([
    { name: 'a plain line', input: 'gg', message: 'gg' },
    { name: 'padding and line breaks', input: '  first\n\nsecond\t', message: 'first second' },
    { name: 'exactly 200 emoji', input: '🔥'.repeat(200), message: '🔥'.repeat(200) },
  ])('accepts $name', ({ input, message }) => {
    expect(expectOk(validateChatMessage(input))).toBe(message);
  });

  it.each([
    { name: 'an empty line', input: '' },
    { name: 'only whitespace', input: ' \n ' },
    { name: '201 characters', input: 'a'.repeat(201) },
  ])('rejects $name', ({ input }) => {
    expect(expectErr(validateChatMessage(input))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'message',
      maxLength: 200,
    });
  });
});
