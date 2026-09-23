import { DevTokenVerifier } from '@vp/adapters/auth';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { getDevJwks, mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import fastify, { type FastifyInstance } from 'fastify';
import { ChannelService } from '../../services/channel-service';
import { type AdminCredential, adminCredential, registerAuth } from '../auth';
import { registerErrorHandler } from '../errors';

const OPERATOR: AdminCredential = {
  token: 'rotated-operator-token',
  userId: '00000000-0000-7000-8000-0000000000b1',
};

function channels(): ChannelService {
  const repositories = new InMemoryRepositories();
  return new ChannelService({ users: repositories.users, channels: repositories.channels });
}

const verifier = new DevTokenVerifier({
  jwks: getDevJwks(),
  issuer: 'vp-dev',
  audience: 'vp-api',
  now: Date.now,
});

async function appWith(
  admin: AdminCredential | undefined,
  channelService = channels()
): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(registerAuth, { channelService, verifier, admin });
  app.get('/whoami', async (request) => ({ user: request.user }));
  return app;
}

async function whoami(app: FastifyInstance, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url: '/whoami', headers });
  return { status: res.statusCode, user: res.statusCode === 200 ? res.json().user : undefined };
}

describe('apps/api/plugins: auth', () => {
  it('admits the dev admin token as the provisioned user it names', async () => {
    const channelService = channels();
    const provision = vi.spyOn(channelService, 'ensureProvisioned');
    const app = await appWith(OPERATOR, channelService);

    expect(await whoami(app, { 'x-admin-token': OPERATOR.token })).toEqual({
      status: 200,
      user: { id: OPERATOR.userId, role: 'ADMIN' },
    });
    expect(provision).toHaveBeenCalledWith(OPERATOR.userId, undefined);
  });

  it.each([
    { scenario: 'an app holding another token', admin: OPERATOR },
    { scenario: 'an app with no admin credential', admin: undefined },
  ])('treats an unknown x-admin-token as nobody on $scenario', async ({ admin }) => {
    const app = await appWith(admin);

    expect(await whoami(app, { 'x-admin-token': 'change-me-32-bytes-random' })).toEqual({
      status: 200,
      user: null,
    });
  });

  it('resolves a bearer token into the caller it names', async () => {
    const app = await appWith(undefined);
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a1', role: 'user' });

    expect(await whoami(app, { authorization: `Bearer ${token}` })).toEqual({
      status: 200,
      user: { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' },
    });
  });

  it.each([
    { scenario: 'a header that is not a bearer token', authorization: 'Basic abc' },
    { scenario: 'a malformed token', authorization: 'Bearer not.a-jwt' },
    { scenario: 'a token for another issuer', authorization: `Bearer ${mintToken({ iss: 'x' })}` },
  ])('answers $scenario with a 401 problem', async ({ authorization }) => {
    const app = await appWith(undefined);
    const res = await app.inject({ method: 'GET', url: '/whoami', headers: { authorization } });

    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('answers 503 rather than 401 when provisioning the caller cannot reach the database', async () => {
    const channelService = channels();
    vi.spyOn(channelService, 'ensureProvisioned').mockResolvedValue(
      err(databaseUnavailable('users.upsert'))
    );
    const app = await appWith(undefined, channelService);
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a2', role: 'user' });

    expect((await whoami(app, { authorization: `Bearer ${token}` })).status).toBe(503);
  });
});

describe('apps/api/plugins: adminCredential', () => {
  it('reads the admin token and the user it acts as from dev mode', () => {
    const auth = inProcessAppConfig({ auth: { adminToken: OPERATOR.token } }).auth;

    expect(adminCredential(auth)).toEqual({
      token: OPERATOR.token,
      userId: '00000000-0000-7000-8000-000000000001',
    });
  });

  it('has no admin credential in dev mode without a token, or in jwks mode at all', () => {
    expect(adminCredential(inProcessAppConfig().auth)).toBeUndefined();
    expect(
      adminCredential({
        type: 'jwks',
        jwksUrl: 'https://idp.example/jwks',
        issuer: 'https://idp.example/',
        audience: 'taitube',
        algorithms: ['RS256'],
        cacheTtlMs: 1,
        refetchIntervalMs: 1,
      })
    ).toBeUndefined();
  });
});
