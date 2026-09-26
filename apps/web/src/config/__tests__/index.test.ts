interface Env {
  ssr: boolean;
  build?: string;
  server?: string;
}

async function apiBaseUrl({ ssr, build, server }: Env): Promise<string> {
  vi.stubEnv('SSR', ssr);
  vi.stubEnv('VITE_API_BASE_URL', build);
  vi.stubEnv('SSR_API_BASE_URL', server);
  vi.resetModules();
  try {
    const { API_BASE_URL } = await import('#app/config');
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
      env: { ssr: false },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'reads VITE_API_BASE_URL and drops a trailing slash',
      env: { ssr: false, build: 'http://api.local:8080/' },
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'ignores an empty override rather than producing a relative URL',
      env: { ssr: false, build: '  ' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'keeps the browser off the address only the SSR server can reach',
      env: { ssr: false, build: 'http://localhost:3000', server: 'http://api:3000' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'sends the SSR server to SSR_API_BASE_URL, trailing slash dropped',
      env: { ssr: true, build: 'http://localhost:3000', server: 'http://api:3000/' },
      expected: 'http://api:3000',
    },
    {
      scenario: 'sends the SSR server where the browser goes when SSR_API_BASE_URL is unset',
      env: { ssr: true, build: 'http://api.local:8080' },
      expected: 'http://api.local:8080',
    },
  ])('$scenario', async ({ env, expected }) => {
    expect(await apiBaseUrl(env)).toBe(expected);
  });

  it.each([
    { name: 'VITE_API_BASE_URL', env: { ssr: false, build: 'not a url' } },
    { name: 'SSR_API_BASE_URL', env: { ssr: true, server: 'not a url' } },
  ])('refuses to start on a $name that is not a URL', async ({ env }) => {
    await expect(apiBaseUrl(env)).rejects.toThrow();
  });
});
