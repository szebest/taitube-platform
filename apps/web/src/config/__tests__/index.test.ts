import { parseWebEnv } from '../index';

describe('apps/web: config', () => {
  it.each([
    {
      scenario: 'defaults to the local API',
      configured: undefined,
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'reads VITE_API_BASE_URL and drops a trailing slash',
      configured: 'http://api.local:8080/',
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'ignores an empty override rather than producing a relative URL',
      configured: '  ',
      expected: 'http://localhost:3000',
    },
  ])('$scenario', ({ configured, expected }) => {
    expect(parseWebEnv({ VITE_API_BASE_URL: configured }).apiBaseUrl).toBe(expected);
  });

  it('refuses an override that is not a URL', () => {
    expect(() => parseWebEnv({ VITE_API_BASE_URL: 'not a url' })).toThrow();
  });

  it('reads the value Vite inlines into this build', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://inlined.local:9999');
    vi.resetModules();

    const { API_BASE_URL } = await import('../index');

    expect(API_BASE_URL).toBe('http://inlined.local:9999');
  });
});
