import { createHash } from 'node:crypto';
import { INVITE_LINK_TTL_MS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const LINKS = `/v1/watch-parties/${ROOM_ID}/invite-links`;
const ABSENT = '018f0000-0000-7000-8000-00000000ffff';

describe('watch party invite link routes', () => {
  let ctx: RoomApp;
  let owner: Account;
  let member: Account;
  let stranger: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner, member } = ctx);
    stranger = await ctx.account(3);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const create = (who: Account | null, payload: Record<string, unknown> = {}) =>
    ctx.call(who, 'POST', LINKS, payload);

  it.each([
    { label: '1h', payload: { ttl: '1h', maxUses: 5 }, lasts: '1h', maxUses: 5 },
    { label: '24h', payload: { ttl: '24h', maxUses: 5 }, lasts: '24h', maxUses: 5 },
    { label: '7d', payload: { ttl: '7d', maxUses: 5 }, lasts: '7d', maxUses: 5 },
    { label: 'no ttl, so 24h', payload: {}, lasts: '24h', maxUses: null },
  ] as const)('creates a link of $label, answering its token once', async (row) => {
    const before = Date.now();

    const res = await create(owner, row.payload);

    expect(res.statusCode).toBe(201);
    const { id, token, url, expiresAt } = res.json();
    expect(url).toBe(`http://localhost:5173/parties/${ROOM_ID}?invite=${token}`);
    expect(Date.parse(expiresAt) - before).toBeGreaterThanOrEqual(INVITE_LINK_TTL_MS[row.lasts]);
    const stored = expectOk(
      await ctx.repositories.watchPartyInviteLinks.findByTokenHash(
        createHash('sha256').update(token).digest('hex')
      )
    );
    expect(stored).toMatchObject({
      id,
      roomId: ROOM_ID,
      createdBy: owner.key,
      maxUses: row.maxUses,
      uses: 0,
    });
  });

  it('lists the links without their tokens, and revokes one without touching a member', async () => {
    const { id, token } = (await create(owner)).json();

    const listed = await ctx.call(owner, 'GET', LINKS);
    const revoked = await ctx.call(owner, 'DELETE', `${LINKS}/${id}`);
    const after = await ctx.call(owner, 'GET', LINKS);

    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toEqual([
      expect.objectContaining({ id, createdBy: owner.key, uses: 0, maxUses: null, revoked: false }),
    ]);
    expect(JSON.stringify(listed.json())).not.toContain(token);
    expect(revoked.statusCode).toBe(204);
    expect(after.json().items).toEqual([expect.objectContaining({ id, revoked: true })]);
    const seated = expectOk(await ctx.repositories.watchPartyMembers.listSeated(ROOM_ID));
    expect(seated.map(({ memberKey }) => memberKey)).toEqual([owner.key, member.key]);
  });

  it.each([
    { scenario: 'a link that does not exist', link: ABSENT, repeat: false },
    { scenario: 'a link already revoked', link: null, repeat: true },
  ])('answers 404 when revoking $scenario', async ({ link, repeat }) => {
    const { id } = (await create(owner)).json();
    if (repeat) await ctx.call(owner, 'DELETE', `${LINKS}/${id}`);

    const res = await ctx.call(owner, 'DELETE', `${LINKS}/${link ?? id}`);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it.each([
    { who: 'a member without members.invite', method: 'POST' as const, status: 403 },
    { who: 'a member without members.invite', method: 'GET' as const, status: 403 },
    { who: 'a member without members.invite', method: 'DELETE' as const, status: 403 },
    { who: 'a stranger', method: 'POST' as const, status: 404 },
    { who: 'a stranger', method: 'GET' as const, status: 404 },
    { who: 'nobody signed in', method: 'POST' as const, status: 404 },
    { who: 'nobody signed in', method: 'GET' as const, status: 401 },
  ])('answers $status to $who on $method', async ({ who, method, status }) => {
    await ctx.memberMayOnly('queue.vote');
    const caller =
      { 'a member without members.invite': member, 'a stranger': stranger }[who] ?? null;
    const suffix = method === 'DELETE' ? `/${ABSENT}` : '';

    const res = await ctx.call(
      caller,
      method,
      `${LINKS}${suffix}`,
      method === 'POST' ? {} : undefined
    );

    expect(res.statusCode).toBe(status);
  });

  it('answers 410 when creating a link for a room that has closed', async () => {
    await ctx.closeRoom();

    const res = await create(owner);

    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
  });

  it.each([{ ttl: '2d' }, { maxUses: 0 }, { maxUses: 1001 }])(
    'refuses the body %j',
    async (payload) => {
      expect((await create(owner, payload)).statusCode).toBe(400);
    }
  );
});
