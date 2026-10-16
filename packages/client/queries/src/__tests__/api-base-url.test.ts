import { EnvHostnameSchema, EnvUrlSchema, resolveApiBaseUrl } from '../api-base-url';

describe('@vp/queries: api base url', () => {
  it.each([
    { scenario: 'an unset variable', raw: undefined, parsed: undefined },
    { scenario: 'blank text', raw: '  ', parsed: undefined },
    {
      scenario: 'a URL with a trailing slash',
      raw: 'http://api.local:8080/',
      parsed: 'http://api.local:8080',
    },
    {
      scenario: 'a URL with spaces around it',
      raw: ' http://localhost:3000 ',
      parsed: 'http://localhost:3000',
    },
  ])('reads $scenario from the environment', ({ raw, parsed }) => {
    expect(EnvUrlSchema.parse(raw)).toBe(parsed);
  });

  it('refuses text that is not a URL', () => {
    expect(() => EnvUrlSchema.parse('not a url')).toThrow();
  });

  it.each([
    { scenario: 'an unset variable', raw: undefined, parsed: undefined },
    { scenario: 'blank text', raw: ' ', parsed: undefined },
    { scenario: 'a domain with spaces around it', raw: ' taitube.local ', parsed: 'taitube.local' },
  ])('reads $scenario as a hostname', ({ raw, parsed }) => {
    expect(EnvHostnameSchema.parse(raw)).toBe(parsed);
  });

  it('refuses a hostname with a scheme or a path', () => {
    expect(() => EnvHostnameSchema.parse('https://taitube.local/')).toThrow();
  });

  it.each([
    {
      scenario: 'keeps the browser off the address only the SSR server can reach',
      ssr: false,
      serverEnv: { SSR_API_BASE_URL: 'http://api:3000' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'sends the SSR server to SSR_API_BASE_URL',
      ssr: true,
      serverEnv: { SSR_API_BASE_URL: 'http://api:3000/' },
      expected: 'http://api:3000',
    },
    {
      scenario: 'sends the SSR server where the browser goes when SSR_API_BASE_URL is unset',
      ssr: true,
      serverEnv: {},
      expected: 'http://localhost:3000',
    },
  ])('$scenario', ({ ssr, serverEnv, expected }) => {
    expect(resolveApiBaseUrl({ ssr, browser: 'http://localhost:3000', serverEnv })).toBe(expected);
  });

  it('refuses to start the SSR server on an SSR_API_BASE_URL that is not a URL', () => {
    expect(() =>
      resolveApiBaseUrl({
        ssr: true,
        browser: 'http://localhost:3000',
        serverEnv: { SSR_API_BASE_URL: 'not a url' },
      })
    ).toThrow();
  });
});
