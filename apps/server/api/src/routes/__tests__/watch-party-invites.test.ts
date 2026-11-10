import type { NotificationPreferences } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const INVITES = `/v1/watch-parties/${ROOM_ID}/invites`;
const ABSENT = '018f0000-0000-7000-8000-00000000ffff';

describe('watch party invite routes', () => {
  let ctx: RoomApp;
  let owner: Account;
  let member: Account;
  let guest: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner, member } = ctx);
    guest = await ctx.account(3);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const invite = (who: Account | null, ...invitees: Account[]) =>
    ctx.call(who, 'POST', INVITES, { userIds: invitees.map(({ user }) => user.id) });

  it('sends an invite to each account and queues one notification for each', async () => {
    const [second] = [await ctx.account(4)];

    const res = await invite(owner, guest, second);

    expect(res.statusCode).toBe(201);
    const { sent, folded, refused } = res.json();
    expect(sent).toEqual([
      { userId: guest.user.id, inviteId: expect.any(String) },
      { userId: second.user.id, inviteId: expect.any(String) },
    ]);
    expect([folded, refused]).toEqual([[], []]);
    expect((await ctx.inviteJobIds()).sort()).toEqual(
      sent.map(({ inviteId }: { inviteId: string }) => `${inviteId}--notify-party-invite`).sort()
    );
  });

  it('folds a second inviter into the invite the account already holds', async () => {
    await invite(owner, guest);

    const res = await invite(member, guest);

    expect(res.json()).toEqual({ sent: [], folded: [{ userId: guest.user.id }], refused: [] });
    expect(await ctx.inviteJobIds()).toHaveLength(1);
  });

  it.each([
    { setting: 'watchParties off', prefs: { watchParties: false }, subscribed: false, sent: false },
    {
      setting: 'invites from nobody',
      prefs: { watchPartyInvites: 'nobody' },
      subscribed: true,
      sent: false,
    },
    {
      setting: 'invites from subscriptions, not subscribed',
      prefs: { watchPartyInvites: 'subscriptions' },
      subscribed: false,
      sent: false,
    },
    {
      setting: 'invites from subscriptions, subscribed',
      prefs: { watchPartyInvites: 'subscriptions' },
      subscribed: true,
      sent: true,
    },
    {
      setting: 'invites from everyone',
      prefs: { watchPartyInvites: 'everyone' },
      subscribed: false,
      sent: true,
    },
    { setting: 'no saved settings', prefs: {}, subscribed: false, sent: true },
  ] as {
    setting: string;
    prefs: Partial<NotificationPreferences>;
    subscribed: boolean;
    sent: boolean;
  }[])(
    'answers sent: $sent to an account with $setting, saying nothing of why',
    async ({ prefs, subscribed, sent }) => {
      await ctx.prefers(guest, prefs);
      if (subscribed) {
        const channel = expectOk(await ctx.repositories.channels.findByUserId(owner.user.id));
        expectOk(await ctx.repositories.subscriptions.subscribe(guest.user.id, channel?.id ?? ''));
      }

      const res = await invite(owner, guest);

      const asked = { userId: guest.user.id };
      expect(res.json()).toEqual({
        sent: sent ? [{ ...asked, inviteId: expect.any(String) }] : [],
        folded: [],
        refused: sent ? [] : [asked],
      });
      expect(await ctx.inviteJobIds()).toHaveLength(sent ? 1 : 0);
    }
  );

  it.each([
    { scenario: 'who already holds a seat', target: 'member' },
    { scenario: 'who is the inviter', target: 'owner' },
    { scenario: 'who has no account here', target: 'unknown' },
  ])('refuses an invitee $scenario', async ({ target }) => {
    const userId = { member, owner, unknown: { user: { id: ABSENT } } }[target]?.user.id;

    const res = await ctx.call(owner, 'POST', INVITES, { userIds: [userId] });

    expect(res.json()).toEqual({ sent: [], folded: [], refused: [{ userId }] });
  });

  it('refuses the 31st invite of an hour with a wait, counting a refusal and a fold too', async () => {
    await ctx.prefers(guest, { watchParties: false });
    const statuses: number[] = [];
    for (let n = 0; n < 31; n += 1) statuses.push((await invite(owner, guest)).statusCode);
    const last = await invite(owner, guest);

    expect(statuses.slice(0, 30).every((status) => status === 201)).toBe(true);
    expect(statuses[30]).toBe(429);
    expect(last.json().code).toBe(ErrorCodes.RATE_LIMITED);
    expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
  });

  it.each([
    {
      who: 'a member without members.invite',
      status: 403,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    { who: 'a stranger', status: 404, code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
    { who: 'nobody signed in', status: 401, code: ErrorCodes.UNAUTHORIZED },
  ])('answers $status to $who', async ({ who, status, code }) => {
    await ctx.memberMayOnly('queue.vote');
    const caller = { 'a member without members.invite': member, 'a stranger': guest }[who] ?? null;

    const res = await invite(caller, guest);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
    expect(await ctx.inviteJobIds()).toEqual([]);
  });

  it('answers 410 for a room that has closed', async () => {
    await ctx.closeRoom();

    const res = await invite(owner, guest);

    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
  });

  describe('listing, revoking and declining', () => {
    const inviteId = async (who: Account, invitee: Account): Promise<string> =>
      (await invite(who, invitee)).json().sent[0].inviteId;

    it('lists pending and joined invites, a declined one as pending', async () => {
      const [declined, joined] = [await ctx.account(4), await ctx.account(5)];
      const pending = await inviteId(owner, guest);
      const declinedId = await inviteId(owner, declined);
      const joinedId = await inviteId(owner, joined);
      await ctx.call(declined, 'POST', `/v1/me/watch-party-invites/${declinedId}/decline`);
      expectOk(await ctx.repositories.watchPartyInvites.markJoined(joinedId));

      const res = await ctx.call(owner, 'GET', INVITES);

      expect(res.statusCode).toBe(200);
      const statuses = Object.fromEntries(
        res.json().items.map(({ id, status }: { id: string; status: string }) => [id, status])
      );
      expect(statuses).toEqual({
        [pending]: 'pending',
        [declinedId]: 'pending',
        [joinedId]: 'joined',
      });
    });

    it('revokes an invite so it admits nobody, and answers 404 for one that is not there', async () => {
      const id = await inviteId(owner, guest);

      const revoked = await ctx.call(owner, 'DELETE', `${INVITES}/${id}`);
      const again = await ctx.call(owner, 'DELETE', `${INVITES}/${id}`);

      expect([revoked.statusCode, again.statusCode]).toEqual([204, 404]);
      expect(
        expectOk(
          await ctx.repositories.watchPartyInvites.findValid(ROOM_ID, guest.user.id, new Date())
        )
      ).toBeNull();
    });

    it.each([
      { method: 'GET' as const, suffix: '' },
      { method: 'DELETE' as const, suffix: `/${ABSENT}` },
    ])('answers 403 to $method for a member without members.invite', async ({ method, suffix }) => {
      await ctx.memberMayOnly('queue.vote');

      const res = await ctx.call(member, method, `${INVITES}${suffix}`);

      expect(res.statusCode).toBe(403);
    });

    it('lets only the invitee decline, once, and tells nobody', async () => {
      const id = await inviteId(owner, guest);
      const url = `/v1/me/watch-party-invites/${id}/decline`;

      const asOther = await ctx.call(member, 'POST', url);
      const declined = await ctx.call(guest, 'POST', url);
      const again = await ctx.call(guest, 'POST', url);
      const anonymous = await ctx.call(null, 'POST', url);

      expect([
        asOther.statusCode,
        declined.statusCode,
        again.statusCode,
        anonymous.statusCode,
      ]).toEqual([404, 204, 404, 401]);
      expect(asOther.json().code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
      expect(ctx.cache.publishedMessages).toEqual([]);
    });
  });
});
