import { DevTokenVerifier } from '@vp/adapters/auth';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { getDevJwks, mintToken } from '@vp/dev-token';
import { type AuthConfig, inProcessAppConfig } from '@vp/env-schema';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import fastify, { type FastifyInstance } from 'fastify';
import { channelServiceDeps } from '../../services/__tests__/service-deps';
import { ChannelService } from '../../services/channel-service';
import { RequestIdentity } from '../../services/request-identity';
import { registerAuth, requireActingChannel } from '../auth';
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

function identityOver(repositories: InMemoryRepositories): RequestIdentity {
  return new RequestIdentity({
    channels: new ChannelService(channelServiceDeps(repositories)),
    members: repositories.channelMembers,
  });
}

const verifier = new DevTokenVerifier({
  jwks: getDevJwks(),
  issuer: 'vp-dev',
  audience: 'vp-api',
  now: Date.now,
});

async function appWith(
  auth: AuthConfig,
  identity = identityOver(new InMemoryRepositories())
): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(registerAuth, { identity, verifier, auth });
  app.get('/whoami', async (request) => ({ user: request.user }));
  app.get('/acting', async (request) => requireActingChannel(request).acting);
  return app;
}

async function whoami(app: FastifyInstance, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url: '/whoami', headers });
  return { status: res.statusCode, user: res.statusCode === 200 ? res.json().user : undefined };
}

async function acting(app: FastifyInstance, headers: Record<string, string>) {
  const res = await app.inject({ method: 'GET', url: '/acting', headers });
  return res.statusCode === 200
    ? { status: res.statusCode, acting: res.json() }
    : { status: res.statusCode, code: res.json().code };
}

describe('apps/server/api/plugins: auth', () => {
  it('admits the dev admin token as the provisioned user it names', async () => {
    const repositories = new InMemoryRepositories();
    const app = await appWith(devAuth(OPERATOR_TOKEN), identityOver(repositories));

    expect(await whoami(app, { 'x-admin-token': OPERATOR_TOKEN })).toMatchObject({
      status: 200,
      user: { id: OPERATOR_ID, role: 'ADMIN', memberships: {} },
    });
    expect(expectOk(await repositories.channels.findByUserId(OPERATOR_ID))).not.toBeNull();
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

    expect(await whoami(app, { authorization: `Bearer ${token}` })).toMatchObject({
      status: 200,
      user: { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER', memberships: {} },
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
    const repositories = new InMemoryRepositories();
    const identity = new RequestIdentity({
      channels: { ensureProvisioned: async () => err(databaseUnavailable('users.upsert')) },
      members: repositories.channelMembers,
    });
    const app = await appWith(devAuth(undefined), identity);
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a2', role: 'user' });

    expect((await whoami(app, { authorization: `Bearer ${token}` })).status).toBe(503);
  });

  describe('the acting channel', () => {
    const OWNER_ID = '00000000-0000-7000-8000-0000000000c1';
    const MEMBER_ID = '00000000-0000-7000-8000-0000000000c2';
    const INVITE_ID = '00000000-0000-7000-8000-0000000000c3';
    const bearer = (sub: string) => ({
      authorization: `Bearer ${mintToken({ sub, role: 'user' })}`,
    });

    async function team() {
      const repositories = new InMemoryRepositories();
      const identity = identityOver(repositories);
      const owner = expectOk(await identity.resolve({ id: OWNER_ID, role: 'USER' }));
      const { channelId } = expectOk(owner.acting);
      expectOk(await identity.resolve({ id: MEMBER_ID, role: 'USER' }));
      const audit = {
        channelId,
        actorUserId: OWNER_ID,
        targetType: 'invite',
        targetId: INVITE_ID,
        meta: { inviteeUserId: MEMBER_ID, role: 'editor' },
      } as const;
      expectOk(
        await repositories.channelInvites.create(
          {
            id: INVITE_ID,
            channelId,
            inviteeUserId: MEMBER_ID,
            role: 'editor',
            invitedBy: OWNER_ID,
            expiresAt: new Date(Date.now() + 60_000),
          },
          { ...audit, action: 'invite.created' }
        )
      );
      expectOk(
        await repositories.channelInvites.accept(INVITE_ID, MEMBER_ID, {
          ...audit,
          actorUserId: MEMBER_ID,
          action: 'invite.accepted',
        })
      );
      return {
        app: await appWith(devAuth(undefined), identity),
        repositories,
        channelId,
      };
    }

    it('acts as a member, with their role, on the channel X-Channel-Id names', async () => {
      const { app, channelId } = await team();

      const headers = { ...bearer(MEMBER_ID), [CHANNEL_HEADER]: channelId };

      expect(await whoami(app, headers)).toMatchObject({
        status: 200,
        user: { memberships: { [channelId]: { role: 'editor', ownerId: OWNER_ID } } },
      });
      expect(await acting(app, headers)).toEqual({
        status: 200,
        acting: { channelId, ownerId: OWNER_ID, role: 'editor' },
      });
    });

    it('refuses a channel the caller is not on, and a member removed since, only where it is needed', async () => {
      const { app, repositories, channelId } = await team();
      const asMember = { ...bearer(MEMBER_ID), [CHANNEL_HEADER]: channelId };
      const stranger = {
        ...bearer('00000000-0000-7000-8000-0000000000c4'),
        [CHANNEL_HEADER]: channelId,
      };

      expect(await acting(app, stranger)).toEqual({
        status: 403,
        code: 'CHANNEL_MEMBERSHIP_REQUIRED',
      });

      expect((await acting(app, asMember)).status).toBe(200);
      expectOk(
        await repositories.channelMembers.remove(
          { channelId, userId: MEMBER_ID, role: 'editor' },
          {
            channelId,
            actorUserId: OWNER_ID,
            action: 'member.removed',
            targetType: 'member',
            targetId: MEMBER_ID,
            meta: { role: 'editor' },
          }
        )
      );
      expect(await acting(app, asMember)).toEqual({
        status: 403,
        code: 'CHANNEL_MEMBERSHIP_REQUIRED',
      });
      expect((await whoami(app, asMember)).status).toBe(200);
    });
  });
});
