import { verifyToken } from '../jwt';
import { DEV_KEY_ID } from '../keys';
import { serveDevTokens } from '../server';

async function serve() {
  const { server, url } = await serveDevTokens(0);
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

  it.each(['/.well-known/jwks.json', '/jwks.json'])(
    'serves the dev key set at %s',
    async (path) => {
      expect((await server.getJson(path)).keys[0].kid).toBe(DEV_KEY_ID);
    }
  );

  it('answers /token with the token of the persona it names', async () => {
    const { token } = await server.getJson('/token?persona=admin');

    expect(verifyToken(token).role).toBe('admin');
  });

  it.each([
    { asked: 'an unknown persona', path: '/token?persona=root' },
    { asked: 'no persona', path: '/token' },
  ])('answers $asked with 404', async ({ path }) => {
    expect((await server.get(path)).status).toBe(404);
  });
});
