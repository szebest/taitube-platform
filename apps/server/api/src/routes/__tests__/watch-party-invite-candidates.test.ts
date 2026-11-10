import { MS_PER_DAY, MS_PER_HOUR } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
} from '../../__tests__/watch-party-room-app';

const CANDIDATES = `/v1/watch-parties/${ROOM_ID}/invite-candidates`;

describe('watch party invite candidate routes', () => {
  let ctx: RoomApp;
  let owner: Account;
  let member: Account;
  let recent: Account;
  let subscribed: Account;
  let unrelated: Account;
  let longAgo: Account;

  const seatOnce = async (who: Account, joinedAt: Date) => {
    const { watchPartyMembers } = ctx.repositories;
    expectOk(
      await watchPartyMembers.join(
        {
          roomId: ROOM_ID,
          memberKey: who.key,
          kind: 'user',
          userId: who.user.id,
          discordUserId: null,
          displayName: null,
          avatarUrl: null,
          ipHash: null,
          joinedVia: 'link',
          joinedAt,
        },
        null
      )
    );
    expectOk(await watchPartyMembers.leave(ROOM_ID, who.key, null, new Date()));
  };

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner, member } = ctx);
    recent = await ctx.account(3);
    subscribed = await ctx.account(4);
    unrelated = await ctx.account(5);
    longAgo = await ctx.account(6);
    await seatOnce(recent, new Date(Date.now() + MS_PER_HOUR));
    await seatOnce(longAgo, new Date(Date.now() - 40 * MS_PER_DAY));
    const channel = expectOk(await ctx.repositories.channels.findByUserId(subscribed.user.id));
    expectOk(await ctx.repositories.subscriptions.subscribe(owner.user.id, channel?.id ?? ''));
    await ctx.call(owner, 'POST', `/v1/watch-parties/${ROOM_ID}/invites`, {
      userIds: [recent.user.id],
    });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const people = () => ({ recent, member, subscribed, unrelated, longAgo });

  const candidates = async (query: string) => {
    const res = await ctx.call(owner, 'GET', `${CANDIDATES}${query}`);
    expect(res.statusCode).toBe(200);
    const named = new Map(Object.entries(people()).map(([name, { user }]) => [user.id, name]));
    return res
      .json()
      .items.map((item: { userId: string; reason: string; inRoom: boolean; invited: boolean }) => [
        named.get(item.userId),
        item.reason,
        item.inRoom,
        item.invited,
      ]);
  };

  const RECENT_FIRST = [
    ['recent', 'co_watcher', false, true],
    ['member', 'co_watcher', true, false],
    ['subscribed', 'subscription', false, false],
  ];

  it.each([
    { query: '', expected: RECENT_FIRST },
    { query: '?q=%20', expected: RECENT_FIRST },
    { query: '?q=account-5', expected: [['unrelated', 'match', false, false]] },
    { query: '?q=ACCOUNT-3', expected: [['recent', 'co_watcher', false, true]] },
    { query: '?q=%40account-4', expected: [['subscribed', 'subscription', false, false]] },
  ])('lists $query with the reason each is named by', async ({ query, expected }) => {
    expect(await candidates(query)).toEqual(expected);
  });

  it('names a person once, under the first reason, and never the caller', async () => {
    const listed = await candidates('?q=account');

    expect(listed.map(([name, reason]: [string, string]) => [name, reason])).toEqual([
      ['recent', 'co_watcher'],
      ['member', 'co_watcher'],
      ['subscribed', 'subscription'],
      ['longAgo', 'match'],
      ['unrelated', 'match'],
    ]);
  });

  it('answers at most 20 people', async () => {
    await Promise.all(Array.from({ length: 25 }, (_, n) => ctx.account(10 + n)));

    const listed = await candidates('?q=account');

    expect(listed).toHaveLength(20);
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
    const caller =
      { 'a member without members.invite': member, 'a stranger': unrelated }[who] ?? null;

    const res = await ctx.call(caller, 'GET', CANDIDATES);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });

  it('refuses a query that searches for nothing', async () => {
    const res = await ctx.call(owner, 'GET', `${CANDIDATES}?q=-lofi`);

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
