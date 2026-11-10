import { expectErr, expectOk } from '@vp/testing/result';
import { validateContactEmail } from '../contact-email';

describe('@vp/validation: validateContactEmail', () => {
  it.each([
    { name: 'null, clearing it', input: null, expected: null },
    {
      name: 'an address, lowercased and trimmed',
      input: ' Ada@Example.COM ',
      expected: 'ada@example.com',
    },
    {
      name: 'a plus address',
      input: 'ada+shows@example.co.uk',
      expected: 'ada+shows@example.co.uk',
    },
  ])('accepts $name', ({ input, expected }) => {
    expect(expectOk(validateContactEmail(input))).toEqual(expected);
  });

  it.each([
    { name: 'no at sign', input: 'ada.example.com' },
    { name: 'no domain dot', input: 'ada@example' },
    { name: 'a space inside', input: 'ada lovelace@example.com' },
    { name: 'two at signs', input: 'ada@@example.com' },
    { name: 'an empty string', input: '' },
    { name: 'an address over 254 characters', input: `${'a'.repeat(250)}@example.com` },
  ])('rejects $name against the contactEmail field', ({ input }) => {
    expect(expectErr(validateContactEmail(input))).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'contactEmail',
    });
  });
});
