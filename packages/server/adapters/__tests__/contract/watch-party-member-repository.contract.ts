import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject } from './subjects';
import {
  assignment,
  GUEST_KEY,
  lineAt,
  lineId,
  later,
  OTHER_KEY,
  OTHER_ROOM_ID,
  OWNER_KEY,
  ROOM_ID,
  rolesChange,
  setUpWatchParty,
} from './watch-party-fixtures';
import {
  accountSeat,
  banOf,
  guestSeat,
  IP_HASH,
  OTHER_GUEST_KEY,
} from './watch-party-member-fixtures';
import { describeWatchPartySeatMovesContract } from './watch-party-seat-moves.contract';

export function describeWatchPartyMemberRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyMemberRepository contract', () => {
    const party = setUpWatchParty(makeSubject);
    const members = () => party.subject.repositories.watchPartyMembers;
    const roles = () => party.subject.repositories.watchPartyRoles;
    const seatOf = async (memberKey: string) => expectOk(await members().find(ROOM_ID, memberKey));
    const seatedKeys = async () =>
      expectOk(await members().listSeated(ROOM_ID)).map(({ memberKey }) => memberKey);

    beforeEach(async () => {
      await party.createRoom();
    });

    describe('seats', () => {
      it('seats a member, and a rejoin after leaving keeps how the seat was first gained', async () => {
        const joined = expectOk(await members().join(accountSeat(), lineAt(1)));
        expect(joined).toEqual({ ...accountSeat(), leftAt: null });

        expect(expectOk(await members().leave(ROOM_ID, OTHER_KEY, null, later(5)))).toBe(true);
        expect(await seatOf(OTHER_KEY)).toMatchObject({ leftAt: later(5) });
        expect(await seatedKeys()).toEqual([OWNER_KEY]);

        const back = expectOk(
          await members().join(
            accountSeat({ joinedVia: 'invite', joinedAt: later(9), displayName: 'Tom' }),
            null
          )
        );
        expect(back).toMatchObject({
          joinedVia: 'link',
          joinedAt: later(1),
          displayName: 'Tom',
          leftAt: null,
        });
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });

      it('lists the held seats in the order they were taken', async () => {
        expectOk(await members().join(guestSeat(GUEST_KEY, later(3)), null));
        expectOk(await members().join(accountSeat(), null));

        expect(await seatedKeys()).toEqual([OWNER_KEY, OTHER_KEY, GUEST_KEY]);
      });

      it('leaves a held seat once, writing the line only then', async () => {
        expectOk(await members().join(accountSeat(), null));
        const leave = () => members().leave(ROOM_ID, OTHER_KEY, lineAt(1), later(5));

        expect([expectOk(await leave()), expectOk(await leave())]).toEqual([true, false]);
        expect(expectOk(await members().leave(ROOM_ID, 'user:nobody', lineAt(2), later(5)))).toBe(
          false
        );
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });

      it('removes every held guest and answers their keys', async () => {
        expectOk(await members().join(accountSeat(), null));
        expectOk(await members().join(guestSeat(GUEST_KEY), null));
        expectOk(await members().join(guestSeat(OTHER_GUEST_KEY), null));

        const removed = expectOk(await members().removeGuests(ROOM_ID, lineAt(1), later(6)));

        expect(removed).toEqual([GUEST_KEY, OTHER_GUEST_KEY].sort());
        expect(await seatedKeys()).toEqual([OWNER_KEY, OTHER_KEY]);
        expect(expectOk(await members().removeGuests(ROOM_ID, lineAt(2), later(7)))).toEqual([]);
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });
    });

    describe('bans', () => {
      beforeEach(async () => {
        expectOk(await members().join(guestSeat(), null));
      });

      it('bans a member in one step: seat left, roles dropped, line written', async () => {
        expectOk(await members().join(accountSeat(), null));
        expectOk(await roles().assign(assignment(), rolesChange(1)));

        expectOk(await members().ban(banOf({ memberKey: OTHER_KEY, ipHash: null }), lineAt(2)));

        expect(await seatOf(OTHER_KEY)).toMatchObject({ leftAt: later(3) });
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY))).toEqual([]);
        expect(expectOk(await members().isBanned(ROOM_ID, OTHER_KEY, null))).toBe(true);
        expect(await party.lineIds()).toEqual([lineId(1), lineId(2)]);
      });

      it('replaces an earlier ban, and an unban removes it once', async () => {
        expectOk(await members().ban(banOf(), lineAt(1)));
        expectOk(await members().ban(banOf({ ipHash: 'ip-hash-2', reason: null }), lineAt(2)));

        expect(expectOk(await members().isBanned(ROOM_ID, 'guest:other', IP_HASH))).toBe(false);
        expect(expectOk(await members().isBanned(ROOM_ID, 'guest:other', 'ip-hash-2'))).toBe(true);
        expect([
          expectOk(await members().unban(ROOM_ID, GUEST_KEY)),
          expectOk(await members().unban(ROOM_ID, GUEST_KEY)),
        ]).toEqual([true, false]);
      });

      it.each([
        { scenario: 'the banned key', roomId: ROOM_ID, key: GUEST_KEY, ipHash: null, banned: true },
        {
          scenario: 'the banned key and another IP',
          roomId: ROOM_ID,
          key: GUEST_KEY,
          ipHash: 'x',
          banned: true,
        },
        {
          scenario: 'another key from the banned IP',
          roomId: ROOM_ID,
          key: 'guest:other',
          ipHash: IP_HASH,
          banned: true,
        },
        {
          scenario: 'another key from another IP',
          roomId: ROOM_ID,
          key: 'guest:other',
          ipHash: 'x',
          banned: false,
        },
        {
          scenario: 'another key with no IP',
          roomId: ROOM_ID,
          key: 'guest:other',
          ipHash: null,
          banned: false,
        },
        {
          scenario: 'the banned key in another room',
          roomId: OTHER_ROOM_ID,
          key: GUEST_KEY,
          ipHash: IP_HASH,
          banned: false,
        },
      ])('answers $banned for $scenario', async ({ roomId, key, ipHash, banned }) => {
        expectOk(await members().ban(banOf(), lineAt(1)));

        expect(expectOk(await members().isBanned(roomId, key, ipHash))).toBe(banned);
      });
    });

    describeWatchPartySeatMovesContract(makeSubject);
  });
}
