import { expectOk } from '@vp/testing/result';
import { holdsJoinWhenFull, isRoomMember, joinCapacity } from '../watch-party-admission';
import { toNewSeat } from '../watch-party-principals';
import { assignRole, fillPresence, OWNER_KEY } from './watch-party-access-fixture';
import {
  type PartyBodyOverrides,
  MEMBER,
  OTHER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpAdmission(body: PartyBodyOverrides = {}) {
  const test = watchPartyTestDeps({ config: { watchParties: { maxMembers: 20 } } });
  await seedParty(test);
  const room = await startParty(test, body);
  const capacityFor = (
    seat: { memberKey?: string | null; isOwner?: boolean; joinWhenFull?: boolean } = {}
  ) =>
    joinCapacity(test.deps, {
      room,
      memberKey: seat.memberKey ?? null,
      isOwner: seat.isOwner ?? false,
      joinWhenFull: seat.joinWhenFull ?? false,
    });
  return { ...test, room, capacityFor };
}

describe('apps/server/api/services: joinCapacity', () => {
  it.each([
    { scenario: 'a room with a limit', body: { capacity: 10 }, seat: {}, limit: 10, shown: 10 },
    { scenario: 'a room with none, up to the ceiling', body: {}, seat: {}, limit: 20, shown: 20 },
    {
      scenario: 'the owner, who is never refused',
      body: { capacity: 10 },
      seat: { isOwner: true },
      limit: null,
      shown: 10,
    },
    {
      scenario: 'a holder of the full-room pass, up to the ceiling',
      body: { capacity: 10 },
      seat: { joinWhenFull: true },
      limit: 20,
      shown: 10,
    },
  ])('limits $scenario to $limit, showing $shown', async ({ body, seat, limit, shown }) => {
    const { capacityFor } = await setUpAdmission(body);

    expect(expectOk(await capacityFor(seat))).toMatchObject({ limit, shown });
  });

  it('counts every kind of person who holds a socket', async () => {
    const { capacityFor, room, presence, clock } = await setUpAdmission();
    await presence.admit(room.id, OWNER_KEY, { limit: null, nowMs: clock.nowMs, staleBeforeMs: 0 });
    await presence.admit(room.id, 'guest:abcdefghijklmnop', {
      limit: null,
      nowMs: clock.nowMs,
      staleBeforeMs: 0,
    });
    await presence.admit(room.id, 'discord:123456789012345678', {
      limit: null,
      nowMs: clock.nowMs,
      staleBeforeMs: 0,
    });

    expect(expectOk(await capacityFor())).toMatchObject({ present: 3 });
  });

  it('forgets sockets that have not answered for the stale window', async () => {
    const test = await setUpAdmission();
    await fillPresence(test, test.room.id, 4);

    test.clock.advance(test.deps.config.presence.staleAfterMs + 1);

    expect(expectOk(await test.capacityFor())).toMatchObject({ present: 0 });
  });

  it.each([
    { scenario: 'a key that holds a socket', memberKey: 'user:filler-1', already: true },
    { scenario: 'a key that does not', memberKey: 'user:newcomer', already: false },
    { scenario: 'no key yet', memberKey: null, already: false },
  ])('knows $scenario is present: $already', async ({ memberKey, already }) => {
    const test = await setUpAdmission();
    await fillPresence(test, test.room.id, 3);

    expect(expectOk(await test.capacityFor({ memberKey }))).toMatchObject({
      alreadyPresent: already,
    });
  });
});

describe('apps/server/api/services: holdsJoinWhenFull', () => {
  async function contextOf(
    who: typeof MEMBER | null,
    setUp?: (test: Awaited<ReturnType<typeof setUpAdmission>>) => Promise<void>
  ) {
    const test = await setUpAdmission();
    await setUp?.(test);
    const caller = who === null ? { user: null, party: null, ip: '198.51.100.1' } : userCaller(who);
    const context = expectOk(await test.deps.context.load(test.room.id, caller));
    return holdsJoinWhenFull(context, test.deps.now());
  }

  it.each([
    { scenario: 'the owner', who: OWNER, role: undefined, holds: true },
    { scenario: 'a Moderator', who: MEMBER, role: 'moderator' as const, holds: true },
    { scenario: 'a VIP', who: MEMBER, role: 'vip' as const, holds: true },
    { scenario: 'a plain member', who: OTHER, role: undefined, holds: false },
    {
      scenario: 'a member muted in chat only',
      who: MEMBER,
      role: 'chat_muted' as const,
      holds: false,
    },
    { scenario: 'nobody known', who: null, role: undefined, holds: false },
  ])('is $holds for $scenario, seated or not', async ({ who, role, holds }) => {
    const held = await contextOf(who, async (test) => {
      if (role && who) await assignRole(test, test.room.id, `user:${who.id}`, role);
    });

    expect(held).toBe(holds);
  });
});

describe('apps/server/api/services: isRoomMember', () => {
  it.each([
    { scenario: 'the owner', who: OWNER, held: true },
    { scenario: 'someone seated', who: MEMBER, held: true },
    { scenario: 'a stranger', who: OTHER, held: false },
  ])('is $held for $scenario', async ({ who, held }) => {
    const test = await setUpAdmission();
    expectOk(
      await test.repositories.watchPartyMembers.join(
        toNewSeat({
          roomId: test.room.id,
          principal: { kind: 'user', userId: MEMBER.id },
          joinedVia: 'link',
          joinedAt: test.deps.now(),
          ipHash: null,
        }),
        null
      )
    );

    const context = expectOk(await test.deps.context.load(test.room.id, userCaller(who)));

    expect(isRoomMember(context)).toBe(held);
  });
});
