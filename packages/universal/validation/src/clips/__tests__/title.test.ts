import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateClipTitle } from '../title';

describe('@vp/validation: validateClipTitle', () => {
  it.each([
    { name: 'a plain title', input: 'Best goal', title: 'Best goal' },
    { name: 'a padded title', input: '  Best goal \n', title: 'Best goal' },
    { name: 'control characters', input: 'Be\u0000st', title: 'Best' },
    { name: 'the ceiling in emoji', input: '🎵'.repeat(100), title: '🎵'.repeat(100) },
  ])('accepts $name', ({ input, title }) => {
    expect(expectOk(validateClipTitle(input))).toBe(title);
  });

  it.each([
    { name: 'an empty title', input: '' },
    { name: 'a blank title', input: '   ' },
    { name: 'a title over 100 characters', input: 'a'.repeat(101) },
  ])('rejects $name', ({ input }) => {
    expect(expectErr(validateClipTitle(input))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'title',
      maxLength: 100,
    });
  });
});
