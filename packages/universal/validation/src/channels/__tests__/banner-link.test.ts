import { expectErr, expectOk } from '@vp/testing/result';
import { validateBannerLink } from '../banner-link';

describe('@vp/validation: validateBannerLink', () => {
  it.each([
    { name: 'null, clearing it', input: null, expected: null },
    {
      name: 'a padded label and URL, trimmed',
      input: { label: '  Shop ', url: ' https://shop.example.com ' },
      expected: { label: 'Shop', url: 'https://shop.example.com' },
    },
    {
      name: 'the longest label',
      input: { label: 'a'.repeat(24), url: 'https://example.com' },
      expected: { label: 'a'.repeat(24), url: 'https://example.com' },
    },
  ])('accepts $name', ({ input, expected }) => {
    expect(expectOk(validateBannerLink(input))).toEqual(expected);
  });

  it.each([
    { name: 'an http URL', input: { label: 'Shop', url: 'http://example.com' } },
    { name: 'a javascript: URL', input: { label: 'Shop', url: 'javascript:alert(1)' } },
    { name: 'a URL with credentials', input: { label: 'Shop', url: 'https://a:b@example.com' } },
    { name: 'a blank label', input: { label: '  ', url: 'https://example.com' } },
    {
      name: 'a label over 24 characters',
      input: { label: 'a'.repeat(25), url: 'https://example.com' },
    },
    {
      name: 'a URL over the length limit',
      input: { label: 'Shop', url: `https://e.com/${'a'.repeat(2048)}` },
    },
  ])('rejects $name against the bannerLink field', ({ input }) => {
    expect(expectErr(validateBannerLink(input))).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'bannerLink',
      maxLabelLength: 24,
    });
  });
});
