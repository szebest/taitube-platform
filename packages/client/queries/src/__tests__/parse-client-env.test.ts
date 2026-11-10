import { parseClientEnv } from '../parse-client-env';

const LOCAL = {
  apiBaseUrl: 'http://localhost:3000',
  apiPublicUrl: 'http://localhost:3000',
  webUrl: 'http://localhost:5173',
  cookieDomain: undefined,
  tracesUrl: undefined,
  devTokenUrl: undefined,
};

describe('@vp/queries: parseClientEnv', () => {
  it('defaults to the local stack when the build names nothing', () => {
    expect(parseClientEnv({ env: {}, serverEnv: {} })).toEqual(LOCAL);
  });

  it.each([
    { key: 'VITE_API_BASE_URL', value: 'http://api.taitube.local/', field: 'apiBaseUrl' },
    { key: 'VITE_API_PUBLIC_URL', value: 'https://api.taitube.local/', field: 'apiPublicUrl' },
    { key: 'VITE_WEB_URL', value: 'https://taitube.local/', field: 'webUrl' },
    { key: 'VITE_COOKIE_DOMAIN', value: 'taitube.local', field: 'cookieDomain' },
    { key: 'VITE_OTEL_TRACES_URL', value: 'http://collector.local/v1/traces', field: 'tracesUrl' },
  ])('reads $key into $field, a URL without its trailing slash', ({ key, value, field }) => {
    expect(parseClientEnv({ env: { [key]: value }, serverEnv: {} })).toHaveProperty(
      field,
      value.replace(/\/$/, '')
    );
  });

  it("hands the server's own address of the API to resolveApiBaseUrl", () => {
    const { apiBaseUrl, apiPublicUrl } = parseClientEnv({
      env: { VITE_API_BASE_URL: 'http://localhost:3000' },
      serverEnv: { SSR_API_BASE_URL: 'http://api:3000' },
    });

    expect(apiBaseUrl).toBe('http://api:3000');
    expect(apiPublicUrl).toBe('http://localhost:3000');
  });

  it('reads the server-only address of dev-token serve, never from the build', () => {
    expect(
      parseClientEnv({ env: {}, serverEnv: { SSR_DEV_TOKEN_URL: 'http://dev-token:3002/' } })
    ).toHaveProperty('devTokenUrl', 'http://dev-token:3002');
  });

  it.each([
    { key: 'VITE_API_BASE_URL', value: 'not a url' },
    { key: 'VITE_DEMO_PERSONAS', value: 'yes' },
    { key: 'VITE_COOKIE_DOMAIN', value: 'https://taitube.local' },
  ])('refuses a $key that is not what its schema asks', ({ key, value }) => {
    expect(() => parseClientEnv({ env: { [key]: value }, serverEnv: {} })).toThrow();
  });
});
