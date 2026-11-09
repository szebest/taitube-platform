import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { handOverAbsentOwner, OwnerGrace } from '../watch-party-owner-grace';
import { GUEST_KEY, keyOf, ROOM_ID, roleIdsOf, seatGuest } from './watch-party-moderation-fixture';
import { elapse, fakeTimers, socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

async function present(party: Party, ...keys: string[]) {
  for (const key of keys) {
    const nowMs = party.deps.now().getTime();
    expectOk(await party.presence.admit(ROOM_ID, key, { limit: null, nowMs, staleBeforeMs: 0 }));
    party.clock.advance(1);
  }
}

async function makeModerator(party: Party, user: UserContext) {
  const at = party.deps.now();
  const roles = await roleIdsOf(party.repositories, at);
  expectOk(
    await party.repositories.watchPartyRoles.assign(
      {
        roomId: ROOM_ID,
        memberKey: keyOf(user),
        roleId: roles.moderator,
        grantedBy: keyOf(OWNER),
        expiresAt: null,
        createdAt: at,
      },
      {
        line: {
          id: party.deps.secrets.newId(),
          line: { event: 'role_assigned', actorKey: null, targetKey: null, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        },
        at,
      }
    )
  );
}

describe('the owner’s grace', () => {
  it('keeps ownership while the owner is present', async () => {
    const party = await socketRoom();
    await present(party, keyOf(OWNER), keyOf(MEMBER));

    expect(expectOk(await handOverAbsentOwner(party.deps, ROOM_ID))).toBe('kept');
    expect((await party.room()).ownerKey).toBe(keyOf(OWNER));
  });

  it('passes ownership to the present member with the highest position, with a frame and a line', async () => {
    const party = await socketRoom({ members: [MEMBER, OTHER] });
    await makeModerator(party, OTHER);
    await present(party, keyOf(MEMBER), keyOf(OTHER));

    expect(expectOk(await handOverAbsentOwner(party.deps, ROOM_ID))).toBe('transferred');

    expect((await party.room()).ownerKey).toBe(keyOf(OTHER));
    expect(party.published('owner')).toEqual([
      expect.objectContaining({ memberKey: keyOf(OTHER) }),
    ]);
    const lines = expectOk(
      await party.repositories.watchPartyMessages.listAfter(ROOM_ID, null, 50)
    );
    expect(lines.at(-1)?.system).toMatchObject({ event: 'owner_changed', targetKey: keyOf(OTHER) });
  });

  it('breaks a tie of positions for the longest present', async () => {
    const party = await socketRoom({ members: [MEMBER, OTHER] });
    await present(party, keyOf(OTHER), keyOf(MEMBER));

    expectOk(await handOverAbsentOwner(party.deps, ROOM_ID));

    expect((await party.room()).ownerKey).toBe(keyOf(OTHER));
  });

  it('waits while only guests are present', async () => {
    const party = await socketRoom();
    await seatGuest(party.repositories, party.deps.now());
    await present(party, GUEST_KEY);

    expect(expectOk(await handOverAbsentOwner(party.deps, ROOM_ID))).toBe('waiting');
  });

  describe('its timer', () => {
    beforeEach(() => {
      fakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { scenario: 'hands over once the 60 s run out', cancelled: false, owner: keyOf(MEMBER) },
      {
        scenario: 'holds when the owner is back inside them',
        cancelled: true,
        owner: keyOf(OWNER),
      },
    ])('$scenario', async ({ cancelled, owner }) => {
      const party = await socketRoom();
      await present(party, keyOf(MEMBER));
      const grace = new OwnerGrace(party.deps);

      grace.begin(ROOM_ID);
      await elapse(59_000);
      if (cancelled) grace.cancel(ROOM_ID);
      await elapse(1_000);

      expect((await party.room()).ownerKey).toBe(owner);
    });
  });
});
