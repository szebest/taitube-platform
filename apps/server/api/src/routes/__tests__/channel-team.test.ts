import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-token';
import type { Channel, ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedTeamMember } from '../../__tests__/test-app';

const INVITEE_ID = '00000000-0000-7000-8000-0000000017e1';
const UNKNOWN_ID = '00000000-0000-7000-8000-0000000017e9';
const INVITEE_TOKEN = mintToken({ sub: INVITEE_ID, role: 'user', ttl: '1h' });

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Call {
  method: Method;
  url: string;
  payload?: object;
}

const SCOPED_CALLS: Record<string, Call> = {
  'read the team': { method: 'GET', url: '/v1/me/channel/members' },
  invite: {
    method: 'POST',
    url: '/v1/me/channel/invites',
    payload: { handle: 'ada', role: 'analytics' },
  },
  'revoke an invite': { method: 'DELETE', url: `/v1/me/channel/invites/${UNKNOWN_ID}` },
  'change a role': {
    method: 'PATCH',
    url: `/v1/me/channel/members/${INVITEE_ID}`,
    payload: { role: 'analytics' },
  },
  'remove a member': { method: 'DELETE', url: `/v1/me/channel/members/${INVITEE_ID}` },
  'read the audit log': { method: 'GET', url: '/v1/me/channel/audit' },
};

function memberCall(method: 'PATCH' | 'DELETE', userId: string, payload?: object): Call {
  return { method, url: `/v1/me/channel/members/${userId}`, ...(payload && { payload }) };
}

describe('channel team routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let owner: Channel;

  const send = (token: string | null, { method, url, payload }: Call, channel?: string) =>
    app.inject({
      method,
      url,
      headers: {
        ...(token && bearer(token)),
        ...(channel && { [CHANNEL_HEADER]: channel }),
      },
      ...(payload && { payload }),
    });

  const invite = (role: ChannelRole = 'editor', token = TOKENS.user, channel?: string) =>
    send(
      token,
      { method: 'POST', url: '/v1/me/channel/invites', payload: { handle: 'ada', role } },
      channel
    );

  const answer = (id: string, verb: 'accept' | 'decline', token = INVITEE_TOKEN) =>
    send(token, { method: 'POST', url: `/v1/invites/${id}/${verb}` });

  const join = (role: ChannelRole) =>
    seedTeamMember(repositories, { ownerId: SEEDED.userId, memberId: SEEDED.otherUserId, role });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    const seeded = expectOk(await repositories.channels.findByUserId(SEEDED.userId));
    if (!seeded) throw new Error('The seeded user has no channel');
    owner = seeded;
    expectOk(
      await repositories.channels.create({ userId: INVITEE_ID, handle: 'ada', displayName: 'Ada' })
    );
  });

  it('invites by handle, lists the invite, and joins the invitee on accept', async () => {
    const created = await invite();
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    const team = await send(TOKENS.user, SCOPED_CALLS['read the team'] as Call);
    expect(team.json()).toMatchObject({
      members: [],
      invites: [{ id, invitee: { handle: 'ada' } }],
    });

    const accepted = await answer(id, 'accept');
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({
      channelId: owner.id,
      ownerId: owner.userId,
      role: 'editor',
      channel: { handle: owner.handle, displayName: owner.displayName, avatarUrl: owner.avatarUrl },
    });
    const mine = await send(INVITEE_TOKEN, { method: 'GET', url: '/v1/me/memberships' });
    expect(mine.json().items).toEqual([accepted.json()]);
    expect((await answer(id, 'decline')).json().code).toBe(ErrorCodes.CHANNEL_INVITE_NOT_PENDING);
  });

  it.each([
    { scenario: 'an invite revoked', close: 'revoke' },
    { scenario: 'an invite declined', close: 'decline' },
  ] as const)('refuses to accept $scenario', async ({ close }) => {
    const { id } = (await invite()).json();
    const closed =
      close === 'revoke'
        ? await send(TOKENS.user, { method: 'DELETE', url: `/v1/me/channel/invites/${id}` })
        : await answer(id, 'decline');
    expect(closed.statusCode).toBe(204);

    const accepted = await answer(id, 'accept');
    expect([accepted.statusCode, accepted.json().code]).toEqual([
      409,
      ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    ]);
  });

  it.each([
    { scenario: 'someone else answers', id: 'own', token: TOKENS.otherUser, status: 404 },
    { scenario: 'the invite does not exist', id: UNKNOWN_ID, token: INVITEE_TOKEN, status: 404 },
    { scenario: 'the id is no id', id: 'nope', token: INVITEE_TOKEN, status: 400 },
  ])('refuses an answer when $scenario: $status', async ({ id, token, status }) => {
    const created = (await invite()).json().id;

    expect((await answer(id === 'own' ? created : id, 'accept', token)).statusCode).toBe(status);
  });

  it.each([
    { role: 'editor', allowed: false },
    { role: 'moderator', allowed: false },
    { role: 'analytics', allowed: false },
    { role: 'manager', allowed: true },
  ] as const)('a $role may run the team: $allowed', async ({ role, allowed }) => {
    await join(role);

    for (const [name, call] of Object.entries(SCOPED_CALLS)) {
      const res = await send(TOKENS.otherUser, call, owner.id);
      const refusal = res.statusCode === 403 ? res.json().code : 'none';
      expect(refusal, name).toBe(allowed ? 'none' : ErrorCodes.FORBIDDEN);
    }
  });

  it('refuses every team route on a channel the caller is not on', async () => {
    for (const [name, call] of Object.entries(SCOPED_CALLS)) {
      const res = await send(TOKENS.otherUser, call, owner.id);
      expect([res.statusCode, res.json().code], name).toEqual([
        403,
        ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
      ]);
    }
  });

  it('refuses every team route to an anonymous caller', async () => {
    const calls = [
      ...Object.values(SCOPED_CALLS),
      { method: 'POST', url: `/v1/invites/${UNKNOWN_ID}/accept` },
      { method: 'POST', url: `/v1/invites/${UNKNOWN_ID}/decline` },
      { method: 'GET', url: '/v1/me/memberships' },
      { method: 'GET', url: '/v1/me/invites' },
    ] as const;

    for (const call of calls) expect((await send(null, call)).statusCode).toBe(401);
  });

  it.each<{ scenario: string; call: Call; code: string }>([
    {
      scenario: 'invite a manager',
      call: {
        method: 'POST',
        url: '/v1/me/channel/invites',
        payload: { handle: 'ada', role: 'manager' },
      },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'promote a member to manager',
      call: memberCall('PATCH', SEEDED.otherUserId, { role: 'manager' }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      scenario: 'demote the owner',
      call: memberCall('PATCH', SEEDED.userId, { role: 'editor' }),
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
    {
      scenario: 'remove the owner',
      call: memberCall('DELETE', SEEDED.userId),
      code: ErrorCodes.CHANNEL_OWNER_IMMUTABLE,
    },
  ])('refuses a manager to $scenario', async ({ call, code }) => {
    await join('manager');

    expect((await send(TOKENS.otherUser, call, owner.id)).json().code).toBe(code);
  });

  it('refuses the owner leaving their own channel', async () => {
    const res = await send(TOKENS.user, memberCall('DELETE', SEEDED.userId));

    expect([res.statusCode, res.json().code]).toEqual([400, ErrorCodes.CHANNEL_OWNER_IMMUTABLE]);
  });

  it('changes a role and removes the member as the owner, auditing both', async () => {
    await join('editor');

    const changed = await send(
      TOKENS.user,
      memberCall('PATCH', SEEDED.otherUserId, { role: 'moderator' })
    );
    expect(changed.json()).toMatchObject({ userId: SEEDED.otherUserId, role: 'moderator' });
    expect((await send(TOKENS.user, memberCall('DELETE', SEEDED.otherUserId))).statusCode).toBe(
      204
    );

    const audit = await send(TOKENS.user, { method: 'GET', url: '/v1/me/channel/audit?limit=2' });
    expect(audit.json().items.map(({ action }: { action: string }) => action)).toEqual([
      'member.removed',
      'member.role_changed',
    ]);
  });

  it('lets a member leave by naming the channel, and the next request no longer reaches it', async () => {
    await join('analytics');

    const left = await send(TOKENS.otherUser, memberCall('DELETE', SEEDED.otherUserId), owner.id);
    expect(left.statusCode).toBe(204);

    const audit = await send(TOKENS.user, {
      method: 'GET',
      url: `/v1/me/channel/audit?action=member.left&actorUserId=${SEEDED.otherUserId}`,
    });
    expect(audit.json().items).toMatchObject([
      { action: 'member.left', meta: { role: 'analytics' } },
    ]);
    expect(
      (await send(TOKENS.otherUser, SCOPED_CALLS['read the audit log'] as Call, owner.id)).json()
        .code
    ).toBe(ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED);
  });

  it('refuses a broken audit cursor', async () => {
    const res = await send(TOKENS.user, { method: 'GET', url: '/v1/me/channel/audit?cursor=nope' });

    expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });
});
