import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import {
  AT,
  assignment,
  GUEST_KEY,
  later,
  lineAt,
  OTHER_KEY,
  OTHER_ROOM_ID,
  ROOM_ID,
  roleIdOf,
  rolesChange,
  setUpWatchParty,
} from './watch-party-fixtures';
import { accountSeat, banOf, guestSeat } from './watch-party-member-fixtures';

export function describeWatchPartySeatMovesContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WatchPartyMemberRepository seat moves contract', () => {
    const party = setUpWatchParty(makeSubject);
    const members = () => party.subject.repositories.watchPartyMembers;
    const roles = () => party.subject.repositories.watchPartyRoles;
    const seatOf = async (memberKey: string) => expectOk(await members().find(ROOM_ID, memberKey));

    beforeEach(async () => {
      await party.createRoom();
    });

    describe('seat upgrades', () => {
      const NEW_KEY = `user:${OTHER_OWNER_ID}`;
      const move = (fromKey = GUEST_KEY) =>
        members().moveSeat({
          roomId: ROOM_ID,
          fromKey,
          to: {
            memberKey: NEW_KEY,
            kind: 'user',
            userId: OTHER_OWNER_ID,
            discordUserId: null,
            displayName: null,
            avatarUrl: null,
          },
          at: later(8),
        });

      it('carries the seat, its roles and its ban to the new key and drops the old seat', async () => {
        expectOk(await members().join(guestSeat(), null));
        expectOk(await members().ban(banOf(), lineAt(1)));
        expectOk(await members().join(guestSeat(), null));
        expectOk(await roles().assign(assignment({ memberKey: GUEST_KEY }), rolesChange(2)));
        expectOk(
          await roles().assign(
            assignment({ memberKey: NEW_KEY, roleId: roleIdOf('vip') }),
            rolesChange(3)
          )
        );

        const moved = expectOk(await move());

        expect(moved).toEqual({
          roomId: ROOM_ID,
          memberKey: NEW_KEY,
          kind: 'user',
          userId: OTHER_OWNER_ID,
          discordUserId: null,
          displayName: null,
          avatarUrl: null,
          joinedVia: 'link',
          joinedAt: later(2),
          leftAt: null,
        });
        expect(await seatOf(GUEST_KEY)).toBeNull();
        expect(await seatOf(NEW_KEY)).toEqual(moved);
        const held = expectOk(await roles().assignmentsOf(ROOM_ID, NEW_KEY)).map(
          ({ roleId }) => roleId
        );
        expect(held.sort()).toEqual([roleIdOf('dj'), roleIdOf('vip')].sort());
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, GUEST_KEY))).toEqual([]);
        expect(expectOk(await members().isBanned(ROOM_ID, NEW_KEY, null))).toBe(true);
      });

      it.each([
        { scenario: 'no seat', prepare: async () => {} },
        {
          scenario: 'a seat already left',
          prepare: async () => {
            expectOk(await members().join(guestSeat(), null));
            expectOk(await members().leave(ROOM_ID, GUEST_KEY, null, later(4)));
          },
        },
      ])('answers null when the old key holds $scenario', async ({ prepare }) => {
        await prepare();

        expect(expectOk(await move())).toBeNull();
        expect(await seatOf(NEW_KEY)).toBeNull();
      });
    });

    describe('open rooms of an account', () => {
      it('lists the open rooms where the account holds a seat', async () => {
        await party.createRoom({ id: OTHER_ROOM_ID });
        const closedId = '00000000-0000-7000-8000-00000000e003';
        const leftId = '00000000-0000-7000-8000-00000000e004';
        await party.createRoom({ id: closedId });
        await party.createRoom({ id: leftId });
        for (const roomId of [ROOM_ID, closedId, leftId]) {
          expectOk(await members().join(accountSeat({ roomId }), null));
        }
        expectOk(await members().leave(leftId, OTHER_KEY, null, later(5)));
        expectOk(
          await party.subject.repositories.watchPartyRooms.close(closedId, 'owner', null, AT)
        );

        expect(expectOk(await members().openRoomIdsOf(OTHER_OWNER_ID))).toEqual([ROOM_ID]);
      });
    });
  });
}
