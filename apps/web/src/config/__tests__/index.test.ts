async function apiBaseUrl(configured: string | undefined): Promise<string> {
  vi.stubEnv('VITE_API_BASE_URL', configured);
  vi.resetModules();
  try {
    const { API_BASE_URL } = await import('../index');
    return API_BASE_URL;
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

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
  ])('$scenario', async ({ configured, expected }) => {
    expect(await apiBaseUrl(configured)).toBe(expected);
  });

  it('refuses to start on an override that is not a URL', async () => {
    await expect(apiBaseUrl('not a url')).rejects.toThrow();
  });
});
