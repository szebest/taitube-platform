import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingChannel } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { nodeApiTokenSecrets } from '../../composition/api-token-secrets';
import { ApiTokenService } from '../api-token-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000019a1', role: 'CREATOR' };
const DAY_MS = 86_400_000;
const START = Date.parse('2026-03-01T12:00:00.000Z');

async function setup() {
  const repositories = new InMemoryRepositories();
  expectOk(await repositories.users.upsert({ id: OWNER.id, email: 'o@x.test', role: 'CREATOR' }));
  const { id: channelId } = expectOk(
    await repositories.channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
  );
  const acting: ActingChannel = { channelId, ownerId: OWNER.id, role: 'owner' };
  let now = START;
  const service = new ApiTokenService({
    tokens: repositories.apiTokens,
    secrets: nodeApiTokenSecrets,
    now: () => now,
  });
  const create = async (name = 'nightly') =>
    expectOk(
      await service.create(OWNER, acting, { name, scopes: ['analytics:read'], expiry: '30d' })
    );
  const advance = (ms: number) => {
    now += ms;
  };
  return { repositories, service, acting, create, advance };
}

describe('apps/server/api/services: ApiTokenService', () => {
  it('shows the token once, keeps only its hash, and lists it without it', async () => {
    const { repositories, service, acting, create } = await setup();

    const created = await create();
    const [stored] = expectOk(await repositories.apiTokens.listByUser(OWNER.id, new Date(START)));
    const listed = expectOk(await service.list(OWNER));

    expect(created.token).toMatch(new RegExp(`^tt_pat_${created.prefix}_[0-9a-f]{64}$`));
    expect(created).toMatchObject({
      channelId: acting.channelId,
      scopes: ['analytics:read'],
      status: 'active',
      expiresAt: '2026-03-31T12:00:00.000Z',
      requestsToday: 0,
    });
    expect(JSON.stringify(stored)).not.toContain(created.token.slice(16));
    expect(listed.items).toEqual([expect.not.objectContaining({ token: expect.anything() })]);
  });

  it('authenticates the token as its user, with its grant and the role the user holds now', async () => {
    const { repositories, service, acting, create } = await setup();
    const { id, token } = await create();
    expectOk(await repositories.users.upsert({ id: OWNER.id, email: 'o@x.test', role: 'USER' }));

    expect(expectOk(await service.authenticate(token))).toEqual({
      id: OWNER.id,
      role: 'USER',
      token: { id, channelId: acting.channelId, scopes: ['analytics:read'] },
    });
  });

  it.each([
    {
      scenario: 'a malformed token',
      change: (token: string) => `${token}0`,
      reason: 'malformed token',
    },
    {
      scenario: 'a token with a wrong secret',
      change: (token: string) => `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`,
      reason: 'unknown token',
    },
  ])('refuses $scenario with a 401', async ({ change, reason }) => {
    const { service, create } = await setup();
    const { token } = await create();

    expect(expectErr(await service.authenticate(change(token)))).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
      reason,
    });
  });

  it('refuses a token once it expired, and once it was revoked', async () => {
    const { service, create, advance } = await setup();
    const expiring = await create('expiring');
    const revoked = await create('revoked');

    expectOk(await service.revoke(OWNER, revoked.id));
    advance(30 * DAY_MS);

    expect([
      expectErr(await service.authenticate(revoked.token)),
      expectErr(await service.authenticate(expiring.token)),
    ]).toMatchObject([{ reason: 'token revoked' }, { reason: 'token expired' }]);
  });

  it('caps a user at ten active tokens, and counts an expired one out', async () => {
    const { service, acting, create, advance } = await setup();
    await create('first');
    advance(DAY_MS);
    for (let n = 2; n <= 10; n += 1) await create(`token ${n}`);
    const body = { name: 'eleventh', scopes: ['videos:read' as const], expiry: '90d' as const };

    expect(expectErr(await service.create(OWNER, acting, body)).code).toBe(
      ErrorCodes.API_TOKEN_LIMIT_REACHED
    );
    advance(29 * DAY_MS);
    expect(expectOk(await service.create(OWNER, acting, body)).name).toBe('eleventh');
  });

  it("answers not found for another user's token and for one revoked already", async () => {
    const { service, create } = await setup();
    const { id } = await create();
    const stranger: UserContext = { id: '00000000-0000-7000-8000-0000000019a2', role: 'USER' };

    expect(expectErr(await service.revoke(stranger, id)).code).toBe(ErrorCodes.API_TOKEN_NOT_FOUND);
    expectOk(await service.revoke(OWNER, id));
    expect(expectErr(await service.revoke(OWNER, id)).code).toBe(ErrorCodes.API_TOKEN_NOT_FOUND);
  });

  it('refuses a request made with a token to create, list or revoke tokens', async () => {
    const { service, acting, create } = await setup();
    const { id, token } = await create();
    const viaToken = expectOk(await service.authenticate(token));
    const body = { name: 'n', scopes: ['videos:read' as const], expiry: '90d' as const };

    expect(
      [
        expectErr(await service.create(viaToken, acting, body)),
        expectErr(await service.list(viaToken)),
        expectErr(await service.revoke(viaToken, id)),
      ].map(({ code }) => code)
    ).toEqual([ErrorCodes.FORBIDDEN, ErrorCodes.FORBIDDEN, ErrorCodes.FORBIDDEN]);
  });

  it('records a use as the last use and one more request today', async () => {
    const { service, create, advance } = await setup();
    const { id } = await create();
    advance(60_000);

    expectOk(await service.recordUse(id));

    expect(expectOk(await service.list(OWNER)).items[0]).toMatchObject({
      lastUsedAt: '2026-03-01T12:01:00.000Z',
      requestsToday: 1,
    });
  });
});
