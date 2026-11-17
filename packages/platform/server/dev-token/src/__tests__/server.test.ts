import { verifyToken as verify } from '../jwt';
import { serveDevTokens } from '../server';
import { TEST_CONFIG } from './test-config';

const verifyToken = (token: string) => verify(TEST_CONFIG, token);

async function serve() {
  const { server, url } = await serveDevTokens(TEST_CONFIG, 0);
  const get = (path: string) => fetch(`${url}${path}`);
  return {
    url,
    get,
    getJson: async (path: string) => JSON.parse(await (await get(path)).text()),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('packages/dev-token: server', () => {
  let server: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    server = await serve();
  });

  afterAll(() => server.close());

  it('listens on this machine only', () => {
    expect(new URL(server.url).hostname).toBe('127.0.0.1');
  });

  it.each(TEST_CONFIG.routes.jwks)('serves the dev key set at %s', async (path) => {
    expect((await server.getJson(path)).keys[0].kid).toBe(TEST_CONFIG.keyId);
  });

  it('answers the token route with the token of the persona it names', async () => {
    const { token } = await server.getJson(`${TEST_CONFIG.routes.token}?persona=admin`);

    expect(verifyToken(token).role).toBe('admin');
  });

  it.each([
    { path: '/keys.json', allowed: '*' },
    { path: `${TEST_CONFIG.routes.token}?persona=admin`, allowed: null },
  ])('lets another origin read $path: $allowed', async ({ path, allowed }) => {
    const response = await server.get(path);

    expect(response.headers.get('access-control-allow-origin')).toBe(allowed);
  });

  it.each([
    { asked: 'an unknown persona', path: `${TEST_CONFIG.routes.token}?persona=root` },
    { asked: 'no persona', path: TEST_CONFIG.routes.token },
  ])('answers $asked with 404', async ({ path }) => {
    expect((await server.get(path)).status).toBe(404);
  });
});
