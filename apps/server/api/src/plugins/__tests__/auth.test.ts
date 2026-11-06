import { DevTokenVerifier } from '@vp/adapters/auth';
import { InMemoryPartyGuestSessions, InMemoryRepositories } from '@vp/adapters/in-memory';
import { getDevJwks, mintToken } from '@vp/dev-token';
import { type AuthConfig, inProcessAppConfig } from '@vp/env-schema';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import fastify, { type FastifyInstance } from 'fastify';
import { channelServiceDeps } from '../../services/__tests__/service-deps';
import { ChannelService } from '../../services/channel-service';
import { registerAuth } from '../auth';
import { registerErrorHandler } from '../errors';

const OPERATOR_TOKEN = 'rotated-operator-token';
const OPERATOR_ID = '00000000-0000-7000-8000-0000000000b1';

function devAuth(adminToken: string | undefined): AuthConfig {
  return inProcessAppConfig({ auth: { adminToken, adminUserId: OPERATOR_ID } }).auth;
}

const JWKS_AUTH: AuthConfig = {
  type: 'jwks',
  jwksUrl: 'https://idp.vp.local/jwks',
  issuer: 'https://idp.vp.local/',
  audience: 'taitube',
  algorithms: ['RS256'],
  cacheTtlMs: 1,
  refetchIntervalMs: 1,
  fetchTimeoutMs: 1,
};

function channels(): ChannelService {
  const repositories = new InMemoryRepositories();
  return new ChannelService(channelServiceDeps(repositories));
}

const verifier = new DevTokenVerifier({
  jwks: getDevJwks(),
  issuer: 'vp-dev',
  audience: 'vp-api',
  now: Date.now,
});

const PARTY_ROUTE = '/v1/watch-parties/:id';
const GUEST_CREDENTIAL = 'guest-credential';

async function appWith(
  auth: AuthConfig,
  channelService = channels(),
  guestSessions = new InMemoryPartyGuestSessions()
): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(registerAuth, {
    channelService,
    verifier,
    auth,
    guestSessions,
    partyCredentialTtlSeconds: 60,
  });
  app.get('/whoami', async (request) => ({ user: request.user, party: request.party }));
  app.get(PARTY_ROUTE, async (request) => ({ user: request.user, party: request.party }));
  return app;
}

async function partyApp(): Promise<FastifyInstance> {
  const guestSessions = new InMemoryPartyGuestSessions();
  await guestSessions.issue(
    GUEST_CREDENTIAL,
    {
      principal: { kind: 'guest', guestId: 'g_4Hk9sPq2LmN8vR3t', name: 'Guest 4821' },
      ipHash: 'ip',
    },
    60
  );
  return appWith(devAuth(undefined), channels(), guestSessions);
}

async function whoami(app: FastifyInstance, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url: '/whoami', headers });
  return { status: res.statusCode, user: res.statusCode === 200 ? res.json().user : undefined };
}

describe('apps/server/api/plugins: auth', () => {
  it.each([
    { scenario: 'a partyGuest route', url: '/v1/watch-parties/room-1', resolved: true },
    { scenario: 'any other route', url: '/whoami', resolved: false },
  ])('reads a party credential on $scenario only: $resolved', async ({ url, resolved }) => {
    const app = await partyApp();
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { 'x-party-credential': GUEST_CREDENTIAL },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      user: null,
      party: resolved ? { principal: { kind: 'guest' } } : null,
    });
  });

  it('refuses a party credential that resolves to nothing on a partyGuest route', async () => {
    const app = await partyApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/watch-parties/room-1',
      headers: { 'x-party-credential': 'expired' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'WATCH_PARTY_CREDENTIAL_INVALID' });
  });

  it('admits the dev admin token as the provisioned user it names', async () => {
    const channelService = channels();
    const provision = vi.spyOn(channelService, 'ensureProvisioned');
    const app = await appWith(devAuth(OPERATOR_TOKEN), channelService);

    expect(await whoami(app, { 'x-admin-token': OPERATOR_TOKEN })).toEqual({
      status: 200,
      user: { id: OPERATOR_ID, role: 'ADMIN' },
    });
    expect(provision).toHaveBeenCalledWith(OPERATOR_ID, undefined);
  });

  it.each([
    { scenario: 'a dev app holding another token', auth: devAuth(OPERATOR_TOKEN) },
    { scenario: 'a dev app with no admin token', auth: devAuth(undefined) },
    { scenario: 'a jwks app, which has no static admin', auth: JWKS_AUTH },
  ])('treats an unknown x-admin-token as nobody on $scenario', async ({ auth }) => {
    const app = await appWith(auth);

    expect(await whoami(app, { 'x-admin-token': 'change-me-32-bytes-random' })).toEqual({
      status: 200,
      user: null,
    });
  });

  it('resolves a bearer token into the caller it names', async () => {
    const app = await appWith(devAuth(undefined));
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
    const app = await appWith(devAuth(undefined));
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
    const app = await appWith(devAuth(undefined), channelService);
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a2', role: 'user' });

    expect((await whoami(app, { authorization: `Bearer ${token}` })).status).toBe(503);
  });
});
