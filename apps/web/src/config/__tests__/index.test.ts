describe('apps/web: config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    {
      scenario: 'defaults to the local API',
      configured: undefined,
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'reads REACT_APP_API_BASE_URL and drops a trailing slash',
      configured: 'http://api.local:8080/',
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'ignores an empty override rather than producing a relative URL',
      configured: '',
      expected: 'http://localhost:3000',
    },
  ])('$scenario', async ({ configured, expected }) => {
    vi.stubEnv('REACT_APP_API_BASE_URL', configured);

    const { API_BASE_URL } = await import('../index');

    expect(API_BASE_URL).toBe(expected);
  });
});
