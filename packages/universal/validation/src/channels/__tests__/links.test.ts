import { isErr, isOk } from '@vp/result';
import { CHANNEL_LINK_LIMITS, validateChannelLinks } from '../links';

const link = (n: number) => ({ label: `Link ${n}`, url: `https://example.com/${n}` });

describe('@vp/validation: validateChannelLinks', () => {
  it.each([
    { name: 'no links', input: [], expected: [] },
    {
      name: 'three https links',
      input: [link(1), link(2), link(3)],
      expected: [link(1), link(2), link(3)],
    },
    {
      name: 'the ceiling of links',
      input: Array.from({ length: 5 }, (_, i) => link(i)),
      expected: Array.from({ length: 5 }, (_, i) => link(i)),
    },
    {
      name: 'a padded label and URL, trimmed',
      input: [{ label: '  Shop ', url: ' https://shop.example.com/a?b=1 ' }],
      expected: [{ label: 'Shop', url: 'https://shop.example.com/a?b=1' }],
    },
    {
      name: 'a label of the longest length',
      input: [{ label: 'a'.repeat(40), url: 'https://example.com' }],
      expected: [{ label: 'a'.repeat(40), url: 'https://example.com' }],
    },
  ])('accepts $name', ({ input, expected }) => {
    const result = validateChannelLinks(input);

    expect(isOk(result) && result.value).toEqual(expected);
  });

  it.each([
    { name: 'a sixth link', input: Array.from({ length: 6 }, (_, i) => link(i)) },
    { name: 'an http link', input: [{ label: 'Site', url: 'http://example.com' }] },
    { name: 'a javascript: link', input: [{ label: 'Site', url: 'javascript:alert(1)' }] },
    { name: 'a mailto: link', input: [{ label: 'Mail', url: 'mailto:me@example.com' }] },
    { name: 'a protocol-relative link', input: [{ label: 'Site', url: '//example.com' }] },
    { name: 'a URL that does not parse', input: [{ label: 'Site', url: 'not a url' }] },
    {
      name: 'a URL with credentials',
      input: [{ label: 'Site', url: 'https://me:pw@example.com' }],
    },
    {
      name: 'a URL over the length limit',
      input: [{ label: 'Site', url: `https://example.com/${'a'.repeat(2048)}` }],
    },
    { name: 'a blank label', input: [{ label: '   ', url: 'https://example.com' }] },
    {
      name: 'a label one character too long',
      input: [{ label: 'a'.repeat(41), url: 'https://example.com' }],
    },
    { name: 'one bad link among good ones', input: [link(1), { label: 'Bad', url: 'ftp://x.io' }] },
  ])('rejects $name, naming the field and the limits', ({ input }) => {
    const result = validateChannelLinks(input);

    expect(isErr(result) && result.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'links',
      ...CHANNEL_LINK_LIMITS,
    });
  });
});
