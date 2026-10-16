interface Env {
  ssr?: boolean;
  build?: string;
  server?: string;
  studio?: string;
  cookieDomain?: string;
}

async function configFor({ ssr = false, build, server, studio, cookieDomain }: Env) {
  vi.stubEnv('SSR', ssr);
  vi.stubEnv('VITE_API_BASE_URL', build);
  vi.stubEnv('SSR_API_BASE_URL', server);
  vi.stubEnv('VITE_STUDIO_URL', studio);
  vi.stubEnv('VITE_COOKIE_DOMAIN', cookieDomain);
  vi.resetModules();
  try {
    return await import('#app/config');
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

describe('apps/client/web: config', () => {
  it.each([
    {
      scenario: 'defaults to the local API',
      env: {},
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'reads VITE_API_BASE_URL and drops a trailing slash',
      env: { build: 'http://api.local:8080/' },
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'ignores an empty override rather than producing a relative URL',
      env: { build: '  ' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'keeps the browser off the address only the SSR server can reach',
      env: { build: 'http://localhost:3000', server: 'http://api:3000' },
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
  ])('resolves the API base URL: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).API_BASE_URL).toBe(expected);
  });

  it.each([
    { scenario: 'defaults to the local studio', env: {}, expected: 'http://localhost:5174' },
    {
      scenario: 'reads VITE_STUDIO_URL and drops a trailing slash',
      env: { studio: 'https://studio.taitube.local/' },
      expected: 'https://studio.taitube.local',
    },
  ])('resolves the studio URL: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).STUDIO_URL).toBe(expected);
  });

  it.each([
    {
      scenario: 'writes the theme cookie on this host alone by default',
      env: {},
      expected: undefined,
    },
    {
      scenario: 'reads VITE_COOKIE_DOMAIN, the domain both apps share',
      env: { cookieDomain: 'taitube.local' },
      expected: 'taitube.local',
    },
  ])('resolves the cookie domain: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).COOKIE_DOMAIN).toBe(expected);
  });

  it.each([
    { name: 'VITE_COOKIE_DOMAIN', env: { cookieDomain: 'https://taitube.local' } },
    { name: 'VITE_API_BASE_URL', env: { build: 'not a url' } },
    { name: 'VITE_STUDIO_URL', env: { studio: 'not a url' } },
    { name: 'SSR_API_BASE_URL', env: { ssr: true, server: 'not a url' } },
  ])('refuses to start on a $name that is not a URL', async ({ env }) => {
    await expect(configFor(env)).rejects.toThrow();
  });
});
