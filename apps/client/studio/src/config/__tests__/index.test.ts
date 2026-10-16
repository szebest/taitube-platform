interface Env {
  ssr?: boolean;
  server?: string;
  web?: string;
  cookieDomain?: string;
}

async function configFor({ ssr = false, server, web, cookieDomain }: Env) {
  vi.stubEnv('SSR', ssr);
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
  vi.stubEnv('SSR_API_BASE_URL', server);
  vi.stubEnv('VITE_WEB_URL', web);
  vi.stubEnv('VITE_COOKIE_DOMAIN', cookieDomain);
  vi.resetModules();
  try {
    return await import('#app/config');
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

describe('apps/client/studio: config', () => {
  it('hands resolveApiBaseUrl the build-time address, and the server environment on the server alone', async () => {
    expect((await configFor({})).API_BASE_URL).toBe('http://localhost:3000');
    expect((await configFor({ ssr: true, server: 'http://api:3000' })).API_BASE_URL).toBe(
      'http://api:3000'
    );
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
    { scenario: 'writes the theme cookie on this host alone by default', env: {}, expected: undefined },
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
    { name: 'VITE_WEB_URL', env: { web: 'not a url' } },
  ])('refuses to start on a $name that is not what its schema asks', async ({ env }) => {
    await expect(configFor(env)).rejects.toThrow();
  });
});
