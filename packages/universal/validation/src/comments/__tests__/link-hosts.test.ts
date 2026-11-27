import { hasLinkOutsideAllowlist, isAllowedHost } from '../link-hosts';

describe('@vp/validation: isAllowedHost', () => {
  it.each([
    { host: 'example.com', allowed: ['example.com'], result: true },
    { host: 'www.example.com', allowed: ['example.com'], result: true },
    { host: 'a.b.example.com', allowed: ['example.com'], result: true },
    { host: 'EXAMPLE.com', allowed: ['example.com'], result: true },
    { host: 'notexample.com', allowed: ['example.com'], result: false },
    { host: 'example.com.evil.io', allowed: ['example.com'], result: false },
    { host: 'example.com', allowed: ['www.example.com'], result: false },
    { host: 'example.com', allowed: [], result: false },
  ])('is $result for $host against $allowed', ({ host, allowed, result }) => {
    expect(isAllowedHost(host, allowed)).toBe(result);
  });
});

describe('@vp/validation: hasLinkOutsideAllowlist', () => {
  const allowed = ['example.com'];

  it.each([
    { scenario: 'no link', text: 'just words, e.g. this one', result: false },
    { scenario: 'an allowed link', text: 'see https://example.com/a?b=1', result: false },
    { scenario: 'an allowed subdomain', text: 'see https://blog.example.com', result: false },
    { scenario: 'a link off the list', text: 'see https://evil.io/x', result: true },
    { scenario: 'a www link without a scheme', text: 'go to www.evil.io now', result: true },
    { scenario: 'a bare domain', text: 'visit evil.io today', result: true },
    { scenario: 'a bare allowed domain', text: 'visit example.com today', result: false },
    { scenario: 'a link in capitals', text: 'HTTPS://EVIL.IO', result: true },
    {
      scenario: 'one allowed and one not',
      text: 'https://example.com and https://evil.io',
      result: true,
    },
    { scenario: 'a link closing a bracket', text: '(https://example.com/a)', result: false },
    { scenario: 'a link ending a sentence', text: 'read https://evil.io.', result: true },
    { scenario: 'credentials hiding the host', text: 'https://example.com@evil.io/', result: true },
    { scenario: 'a number with a dot', text: 'it cost 3.50 dollars', result: false },
  ])('is $result for $scenario', ({ text, result }) => {
    expect(hasLinkOutsideAllowlist(text, allowed)).toBe(result);
  });

  it('holds any link when nothing is allowed', () => {
    expect(hasLinkOutsideAllowlist('https://example.com', [])).toBe(true);
  });
});
