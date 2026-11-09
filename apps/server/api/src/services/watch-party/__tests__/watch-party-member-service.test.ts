import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  ABSENT_KEY,
  ESCALATION,
  type Held,
  KEEPER,
  linesOf,
  MISSING,
  NOT_FOUND,
  SEATED,
  seatedCount,
  seatOf,
  setUpParty,
} from './watch-party-member-party';
import { GUEST_KEY, keyOf, ROOM_ID, seatGuest } from './watch-party-moderation-fixture';
import { ANONYMOUS, MEMBER, MODERATOR, OTHER, OWNER, userCaller } from './watch-party-test-deps';

describe('kick', () => {
  it('takes the seat, clears presence, tells that member alone and writes the line', async () => {
    const party = await setUpParty([['moderator', OTHER]]);
    const { service, presence, frames, log, clock } = party;
    const present = { limit: null, nowMs: clock.nowMs, staleBeforeMs: 0 };
    await presence.admit(ROOM_ID, keyOf(MEMBER), present);

    const kicked = await service.kick(ROOM_ID, userCaller(OTHER), keyOf(MEMBER));

    expect(kicked.ok).toBe(true);
    expect((await seatOf(party, keyOf(MEMBER)))?.leftAt).toEqual(new Date(clock.nowMs));
    expect(expectOk(await presence.members(ROOM_ID, 0))).toEqual([]);
    expect(frames()).toEqual([
      expect.objectContaining({ memberKey: keyOf(MEMBER), frame: { type: 'kicked' } }),
    ]);
    expect(await linesOf(party)).toEqual([
      { event: 'kicked', actorKey: keyOf(OTHER), targetKey: keyOf(MEMBER), detail: null },
    ]);
    expect(log.lines()).toEqual([
      expect.objectContaining({
        level: 'info',
        roomId: ROOM_ID,
        actorKey: keyOf(OTHER),
        action: 'member.kick',
        targetKey: keyOf(MEMBER),
      }),
    ]);
  });

  it.each([
    {
      scenario: 'a member without members.kick kicking another',
      held: [],
      actor: MEMBER,
      target: keyOf(OTHER),
      code: MISSING,
    },
    {
      scenario: 'a Moderator kicking the owner',
      held: [['moderator', OTHER]],
      actor: OTHER,
      target: keyOf(OWNER),
      code: ESCALATION,
    },
    {
      scenario: 'a Moderator kicking themselves',
      held: [['moderator', OTHER]],
      actor: OTHER,
      target: keyOf(OTHER),
      code: ESCALATION,
    },
    {
      scenario: 'a Moderator kicking another Moderator',
      held: [
        ['moderator', OTHER],
        ['moderator', KEEPER],
      ],
      actor: OTHER,
      target: keyOf(KEEPER),
      code: ESCALATION,
    },
    {
      scenario: 'a Moderator kicking a Co-host',
      held: [
        ['moderator', OTHER],
        ['cohost', KEEPER],
      ],
      actor: OTHER,
      target: keyOf(KEEPER),
      code: ESCALATION,
    },
    {
      scenario: 'a key that holds no seat',
      held: [['moderator', OTHER]],
      actor: OTHER,
      target: ABSENT_KEY,
      code: NOT_FOUND,
    },
    {
      scenario: 'something that is no key',
      held: [['moderator', OTHER]],
      actor: OTHER,
      target: 'nobody',
      code: NOT_FOUND,
    },
  ] satisfies { scenario: string; held: Held; actor: UserContext; target: string; code: string }[])(
    'refuses $scenario',
    async ({ held, actor, target, code }) => {
      const party = await setUpParty(held);

      const failure = expectErr(await party.service.kick(ROOM_ID, userCaller(actor), target));

      expect(failure.code).toBe(code);
      expect(await seatedCount(party)).toBe(SEATED);
    }
  );

  it('lets a platform moderator kick without a seat of their own', async () => {
    const { service } = await setUpParty();

    const kicked = await service.kick(ROOM_ID, userCaller(MODERATOR), keyOf(MEMBER));

    expect(kicked.ok).toBe(true);
  });
});

describe('removeGuests', () => {
  it('removes every guest, tells each one, and leaves the accounts seated', async () => {
    const party = await setUpParty([['moderator', OTHER]]);
    await seatGuest(party.repositories, party.at, 'guest:second-guest-0001');

    const removed = await party.service.removeGuests(ROOM_ID, userCaller(OTHER));

    expect(removed.ok).toBe(true);
    expect(await seatedCount(party)).toBe(SEATED - 1);
    expect(party.frames().map(({ memberKey }) => memberKey)).toEqual(
      [GUEST_KEY, 'guest:second-guest-0001'].sort()
    );
    expect(await linesOf(party)).toEqual([
      { event: 'kicked', actorKey: keyOf(OTHER), targetKey: null, detail: 'guests' },
    ]);
  });

  it.each([
    { scenario: 'a member without members.kick', actor: MEMBER, removed: false },
    { scenario: 'a platform moderator with no seat', actor: MODERATOR, removed: true },
  ])('answers $scenario with removed: $removed', async ({ actor, removed }) => {
    const party = await setUpParty();

    const result = await party.service.removeGuests(ROOM_ID, userCaller(actor));

    expect(result.ok).toBe(removed);
    expect(await seatedCount(party)).toBe(removed ? SEATED - 1 : SEATED);
  });

  it('answers the anonymous as a stranger to the room', async () => {
    const { service } = await setUpParty();

    const failure = expectErr(await service.removeGuests(ROOM_ID, ANONYMOUS));

    expect(failure.code).toBe(NOT_FOUND);
  });
});
