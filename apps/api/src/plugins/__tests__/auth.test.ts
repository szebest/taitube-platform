import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import fastify, { type FastifyInstance } from 'fastify';
import { ChannelService } from '../../services/channel-service';
import { registerAuth } from '../auth';
import { registerErrorHandler } from '../errors';

function channels(): ChannelService {
  const repositories = new InMemoryRepositories();
  return new ChannelService({ users: repositories.users, channels: repositories.channels });
}

const PUBLISHED_PLACEHOLDER = 'change-me-32-bytes-random';
const JWKS_URL = 'http://127.0.0.1:9/.well-known/jwks.json';

async function appWith(
  adminToken: string | undefined,
  { channelService = channels(), devTokens = true } = {}
): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(registerAuth, {
    channelService,
    auth: { adminToken, jwksUrl: JWKS_URL, devTokens },
  });
  app.get('/whoami', async (request) => ({ user: request.user }));
  return app;
}

async function whoami(app: FastifyInstance, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url: '/whoami', headers });
  return { status: res.statusCode, user: res.statusCode === 200 ? res.json().user : undefined };
}

describe('apps/api/plugins: auth', () => {
  it('admits the configured admin token as the operator', async () => {
    const app = await appWith('rotated-operator-token');

    expect(await whoami(app, { 'x-admin-token': 'rotated-operator-token' })).toMatchObject({
      status: 200,
      user: { role: 'ADMIN' },
    });
  });

  it.each([
    { scenario: 'a production app holding a real token', adminToken: 'rotated-operator-token' },
    { scenario: 'an app with no admin token at all', adminToken: undefined },
  ])('treats the published placeholder as nobody on $scenario', async ({ adminToken }) => {
    const app = await appWith(adminToken);

    expect(await whoami(app, { 'x-admin-token': PUBLISHED_PLACEHOLDER })).toEqual({
      status: 200,
      user: null,
    });
  });

  it('resolves a dev bearer token into the caller it names', async () => {
    const app = await appWith(undefined);
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a1', role: 'user' });

    expect(await whoami(app, { authorization: `Bearer ${token}` })).toMatchObject({
      status: 200,
      user: { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' },
    });
  });

  it('refuses a dev bearer token with 401 where dev tokens are off, as in production', async () => {
    const app = await appWith(undefined, { devTokens: false });
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a3', role: 'ADMIN' });

    expect(await whoami(app, { authorization: `Bearer ${token}` })).toEqual({
      status: 401,
      user: undefined,
    });
  });

  it.each([
    { scenario: 'a header that is not a bearer token', authorization: 'Basic abc' },
    { scenario: 'a malformed token', authorization: 'Bearer not.a-jwt' },
  ])('refuses $scenario with 401', async ({ authorization }) => {
    const app = await appWith(undefined);

    expect((await whoami(app, { authorization })).status).toBe(401);
  });

  it('answers 503 rather than 401 when provisioning the caller cannot reach the database', async () => {
    const channelService = channels();
    vi.spyOn(channelService, 'ensureProvisioned').mockResolvedValue(
      err(databaseUnavailable('users.upsert'))
    );
    const app = await appWith(undefined, { channelService });
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a2', role: 'user' });

    expect((await whoami(app, { authorization: `Bearer ${token}` })).status).toBe(503);
  });
});
