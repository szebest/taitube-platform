import { httpsUrl } from '../https-url';

describe('apps/client/web: httpsUrl', () => {
  it.each([
    { raw: 'https://example.com/a', expected: 'https://example.com/a' },
    { raw: 'https://example.com', expected: 'https://example.com/' },
    { raw: 'http://example.com', expected: undefined },
    { raw: 'javascript:alert(1)', expected: undefined },
    { raw: 'mailto:a@example.com', expected: undefined },
    { raw: '//example.com', expected: undefined },
    { raw: 'not a url', expected: undefined },
  ])('reads $raw as $expected', ({ raw, expected }) => {
    expect(httpsUrl(raw)).toBe(expected);
  });
});
