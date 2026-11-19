import { expectOk } from '@kit/testing/result';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing-fixtures';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedTeamMember } from '../../__tests__/test-app';

const UNKNOWN_ID = '00000000-0000-7000-8000-0000000019e9';

interface Call {
  method: 'GET' | 'POST' | 'PATCH';
  url: string;
  payload?: object;
}

describe('my channels routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const send = (token: string | null, { method, url, payload }: Call, channel?: string) =>
    app.inject({
      method,
      url,
      headers: { ...(token && bearer(token)), ...(channel && { [CHANNEL_HEADER]: channel }) },
      ...(payload && { payload }),
    });

  const create = (handle: string, token = TOKENS.user) =>
    send(token, {
      method: 'POST',
      url: '/v1/me/channels',
      payload: { handle, displayName: handle },
    });

  const promote = (id: string, token = TOKENS.user) =>
    send(token, { method: 'PATCH', url: `/v1/me/channels/${id}`, payload: { isPrimary: true } });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it('creates a second channel, not primary, and audits it on that channel', async () => {
    const created = await create('second');

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ handle: 'second', isPrimary: false });
    const audit = expectOk(
      await repositories.channelAudit.list(created.json().id, { cursor: null, limit: 5 })
    );
    expect(audit).toMatchObject([{ action: 'channel.created', actorUserId: SEEDED.userId }]);
  });

  it('refuses a channel past CHANNELS_MAX_OWNED with 409', async () => {
    for (const handle of ['second', 'third', 'fourth', 'fifth']) {
      expect((await create(handle)).statusCode).toBe(201);
    }

    const refused = await create('sixth');

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: ErrorCodes.CHANNEL_LIMIT_REACHED });
  });

  it.each([
    {
      scenario: 'a handle another channel holds',
      handle: 'user',
      code: ErrorCodes.HANDLE_ALREADY_TAKEN,
    },
    { scenario: 'a malformed handle', handle: 'a!', code: ErrorCodes.INVALID_HANDLE_FORMAT },
  ])('refuses $scenario', async ({ handle, code }) => {
    const refused = await create(handle);

    expect(refused.json()).toMatchObject({ code });
  });

  it('promotes an owned channel, which the account then returns as its channel', async () => {
    const { id } = (await create('second')).json();

    const promoted = await promote(id);
    const account = await send(TOKENS.user, { method: 'GET', url: '/v1/me/account' });

    expect(promoted.statusCode).toBe(200);
    expect(promoted.json()).toMatchObject({ id, isPrimary: true });
    expect(account.json()).toMatchObject({
      channel: { id },
      channels: [{ id }, { id: SEEDED.channelId }],
    });
  });

  it.each([
    {
      scenario: "another user's channel",
      target: SEEDED.otherChannelId,
      status: 403,
      code: ErrorCodes.CHANNEL_NOT_OWNED,
    },
    {
      scenario: 'a channel that is not there',
      target: UNKNOWN_ID,
      status: 404,
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
  ])('refuses to promote $scenario', async ({ target, status, code }) => {
    const refused = await promote(target);

    expect(refused.statusCode).toBe(status);
    expect(refused.json()).toMatchObject({ code });
  });

  it('refuses a manager promoting the channel they manage', async () => {
    const channelId = await seedTeamMember(repositories, {
      ownerId: SEEDED.userId,
      memberId: SEEDED.otherUserId,
      role: 'manager',
    });

    const refused = await promote(channelId, TOKENS.otherUser);

    expect(refused.json()).toMatchObject({ code: ErrorCodes.CHANNEL_NOT_OWNED });
  });

  it('lists the account, its owned channels primary first, and the channels it works on', async () => {
    const { id: second } = (await create('second')).json();
    await seedTeamMember(repositories, {
      ownerId: SEEDED.otherUserId,
      memberId: SEEDED.userId,
      role: 'editor',
    });

    const identities = await send(TOKENS.user, { method: 'GET', url: '/v1/me/identities' });

    expect(identities.json()).toMatchObject({
      account: { id: SEEDED.userId },
      owned: [
        { id: SEEDED.channelId, isPrimary: true },
        { id: second, isPrimary: false },
      ],
      member: [{ id: SEEDED.otherChannelId, role: 'editor', ownerId: SEEDED.otherUserId }],
    });
  });

  it('edits the channel X-Channel-Id names, and the primary without one', async () => {
    const { id: second } = (await create('second')).json();
    const edit = { method: 'PATCH', url: '/v1/me/channel', payload: { bio: 'second' } } as const;

    const named = await send(TOKENS.user, edit, second);
    const unnamed = await send(TOKENS.user, { ...edit, payload: { bio: 'primary' } });

    expect(named.json()).toMatchObject({ id: second, bio: 'second' });
    expect(unnamed.json()).toMatchObject({ id: SEEDED.channelId, bio: 'primary' });
  });

  it.each([
    {
      scenario: 'a channel of another user',
      header: SEEDED.otherChannelId,
      status: 403,
      code: ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
    },
    {
      scenario: 'a value that is no channel id',
      header: 'not-a-uuid',
      status: 400,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses a header naming $scenario with $status', async ({ header, status, code }) => {
    const refused = await send(TOKENS.user, { method: 'GET', url: '/v1/me/channel' }, header);

    expect(refused.statusCode).toBe(status);
    expect(refused.json()).toMatchObject({ code });
  });

  it("walks the caller's own sign-ins newest first and never another user's", async () => {
    for (const slot of [0, 1]) {
      expectOk(
        await repositories.accountAudit.append({
          userId: SEEDED.userId,
          action: 'account.signed_in',
          meta: { slot, userAgent: 'Firefox' },
        })
      );
    }
    expectOk(
      await repositories.accountAudit.append({
        userId: SEEDED.otherUserId,
        action: 'account.signed_in',
        meta: { slot: 0, userAgent: null },
      })
    );
    const page = (cursor?: string) =>
      send(TOKENS.user, {
        method: 'GET',
        url: `/v1/me/security/sign-ins?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
      });

    const first = (await page()).json();
    const second = (await page(first.nextCursor)).json();

    expect([...first.items, ...second.items].map(({ slot }: { slot: number }) => slot)).toEqual([
      1, 0,
    ]);
    expect(second.nextCursor).toBeNull();
  });
});
