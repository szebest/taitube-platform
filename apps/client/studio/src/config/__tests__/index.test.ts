interface Env {
  ssr?: boolean;
  build?: string;
  server?: string;
  web?: string;
}

async function configFor({ ssr = false, build, server, web }: Env) {
  vi.stubEnv('SSR', ssr);
  vi.stubEnv('VITE_API_BASE_URL', build);
  vi.stubEnv('SSR_API_BASE_URL', server);
  vi.stubEnv('VITE_WEB_URL', web);
  vi.resetModules();
  try {
    return await import('#app/config');
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

describe('apps/client/studio: config', () => {
  it.each([
    { scenario: 'defaults to the local API', env: {}, expected: 'http://localhost:3000' },
    {
      scenario: 'reads VITE_API_BASE_URL and drops a trailing slash',
      env: { build: 'http://api.local:8080/' },
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'keeps the browser off the address only the SSR server can reach',
      env: { build: 'http://localhost:3000', server: 'http://api:3000' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'sends the SSR server to SSR_API_BASE_URL',
      env: { ssr: true, build: 'http://localhost:3000', server: 'http://api:3000' },
      expected: 'http://api:3000',
    },
  ])('resolves the API base URL: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).API_BASE_URL).toBe(expected);
  });

  it.each([
    { scenario: 'defaults to the local web app', env: {}, expected: 'http://localhost:5173' },
    {
      scenario: 'reads VITE_WEB_URL and drops a trailing slash',
      env: { web: 'https://taitube.local/' },
      expected: 'https://taitube.local',
    },
  ])('resolves the web URL: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).WEB_URL).toBe(expected);
  });

  it.each([
    { name: 'VITE_API_BASE_URL', env: { build: 'not a url' } },
    { name: 'VITE_WEB_URL', env: { web: 'not a url' } },
    { name: 'SSR_API_BASE_URL', env: { ssr: true, server: 'not a url' } },
  ])('refuses to start on a $name that is not a URL', async ({ env }) => {
    await expect(configFor(env)).rejects.toThrow();
  });
});
