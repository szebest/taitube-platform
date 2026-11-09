import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import type { Channel } from '@vp/domain';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp } from '../../__tests__/test-app';

const INVITEE_ID = '00000000-0000-7000-8000-0000000017e1';
const INVITEE_TOKEN = mintToken({ sub: INVITEE_ID, role: 'user', ttl: '1h' });

describe('GET /v1/me/invites', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let owner: Channel;

  const send = (
    token: string | null,
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    payload?: object
  ) =>
    app.inject({ method, url, headers: token ? bearer(token) : {}, ...(payload && { payload }) });

  const invite = async () =>
    (
      await send(TOKENS.user, 'POST', '/v1/me/channel/invites', { handle: 'ada', role: 'editor' })
    ).json();

  const answer = (id: string, verb: 'accept' | 'decline') =>
    send(INVITEE_TOKEN, 'POST', `/v1/invites/${id}/${verb}`);

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

  const mine = (token = INVITEE_TOKEN, query = '') => send(token, 'GET', `/v1/me/invites${query}`);

  it('lists the invitee own pending invite with the channel, the role and the inviter', async () => {
    const { id } = await invite();

    const res = await mine();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: [
        {
          id,
          channel: {
            id: owner.id,
            handle: owner.handle,
            displayName: owner.displayName,
            avatarUrl: owner.avatarUrl,
          },
          role: 'editor',
          invitedByName: owner.displayName,
          expiresAt: expect.any(String),
        },
      ],
      nextCursor: null,
    });
  });

  it.each([
    { scenario: 'another user asks', token: TOKENS.otherUser, close: undefined },
    { scenario: 'it was declined', token: INVITEE_TOKEN, close: 'decline' },
    { scenario: 'it was revoked', token: INVITEE_TOKEN, close: 'revoke' },
    { scenario: 'it was accepted', token: INVITEE_TOKEN, close: 'accept' },
  ] as const)('does not list it when $scenario', async ({ token, close }) => {
    const { id } = await invite();
    if (close === 'revoke') {
      await send(TOKENS.user, 'DELETE', `/v1/me/channel/invites/${id}`);
    } else if (close) {
      await answer(id, close);
    }

    expect((await mine(token)).json().items).toEqual([]);
  });

  it('does not list an expired invite', async () => {
    const id = '00000000-0000-7000-8000-0000000017e2';
    expectOk(
      await repositories.channelInvites.create(
        {
          id,
          channelId: owner.id,
          inviteeUserId: INVITEE_ID,
          role: 'editor',
          invitedBy: SEEDED.userId,
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          channelId: owner.id,
          actorUserId: SEEDED.userId,
          action: 'invite.created',
          targetType: 'invite',
          targetId: id,
          meta: { inviteeUserId: INVITEE_ID, role: 'editor' },
        }
      )
    );

    expect((await mine()).json().items).toEqual([]);
  });

  it.each([
    { scenario: 'a cursor nobody issued', query: '?cursor=nope', status: 400 },
    { scenario: 'a limit of zero', query: '?limit=0', status: 400 },
  ])('refuses $scenario', async ({ query, status }) => {
    expect((await mine(INVITEE_TOKEN, query)).statusCode).toBe(status);
  });
});
