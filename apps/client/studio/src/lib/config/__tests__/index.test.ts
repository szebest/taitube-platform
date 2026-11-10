interface Env {
  ssr?: boolean;
  server?: string;
  web?: string;
  cookieDomain?: string;
  traces?: string;
  publicApi?: string;
  devToken?: string;
  demoPersonas?: string;
}

async function configFor({
  ssr = false,
  server,
  web,
  cookieDomain,
  traces,
  publicApi,
  devToken,
  demoPersonas,
}: Env) {
  vi.stubEnv('SSR', ssr);
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
  vi.stubEnv('SSR_API_BASE_URL', server);
  vi.stubEnv('SSR_DEV_TOKEN_URL', devToken);
  vi.stubEnv('VITE_DEMO_PERSONAS', demoPersonas);
  vi.stubEnv('VITE_API_PUBLIC_URL', publicApi);
  vi.stubEnv('VITE_WEB_URL', web);
  vi.stubEnv('VITE_COOKIE_DOMAIN', cookieDomain);
  vi.stubEnv('VITE_OTEL_TRACES_URL', traces);
  vi.resetModules();
  try {
    return await import('#app/lib/config');
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
    { scenario: 'in the browser', env: {}, expected: 'http://localhost:3000' },
    {
      scenario: 'on the server, where the API has an internal name',
      env: { ssr: true, server: 'http://api:3000' },
      expected: 'http://localhost:3000',
    },
    {
      scenario: 'from VITE_API_PUBLIC_URL',
      env: { publicApi: 'https://api.taitube.local/' },
      expected: 'https://api.taitube.local',
    },
  ])(
    'keeps the public API address, and links Bull Board on it, $scenario',
    async ({ env, expected }) => {
      const config = await configFor(env);

      expect(config.API_PUBLIC_URL).toBe(expected);
      expect(config.BULL_BOARD_URL).toBe(`${expected}/admin/queues`);
    }
  );

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
    {
      scenario: 'loads no tracer when the build names no collector',
      env: {},
      expected: undefined,
    },
    {
      scenario: 'reads VITE_OTEL_TRACES_URL',
      env: { traces: 'http://collector.taitube.local/v1/traces' },
      expected: 'http://collector.taitube.local/v1/traces',
    },
  ])('resolves the traces URL: $scenario', async ({ env, expected }) => {
    expect((await configFor(env)).OTEL_TRACES_URL).toBe(expected);
  });

  it.each([
    { scenario: 'is unset by default', env: { ssr: true }, expected: undefined },
    {
      scenario: 'reads SSR_DEV_TOKEN_URL on the server',
      env: { ssr: true, devToken: 'http://dev-token:3002/' },
      expected: 'http://dev-token:3002',
    },
    {
      scenario: 'ignores SSR_DEV_TOKEN_URL in the browser',
      env: { devToken: 'http://dev-token:3002' },
      expected: undefined,
    },
  ])("resolves the token server's address: $scenario", async ({ env, expected }) => {
    expect((await configFor(env)).DEV_TOKEN_URL).toBe(expected);
  });

  it.each([
    { name: 'VITE_DEMO_PERSONAS', env: { demoPersonas: 'yes' } },
    { name: 'VITE_COOKIE_DOMAIN', env: { cookieDomain: 'https://taitube.local' } },
    { name: 'VITE_WEB_URL', env: { web: 'not a url' } },
    { name: 'VITE_OTEL_TRACES_URL', env: { traces: 'not a url' } },
  ])('refuses to start on a $name that is not what its schema asks', async ({ env }) => {
    await expect(configFor(env)).rejects.toThrow();
  });
});
