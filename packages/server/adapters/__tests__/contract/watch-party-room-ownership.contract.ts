import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject } from './subjects';
import {
  assignment,
  later,
  lineAt,
  lineId,
  OTHER_KEY,
  OWNER_KEY,
  ROOM_ID,
  roleIdOf,
  rolesChange,
  setUpWatchParty,
} from './watch-party-fixtures';

export function describeWatchPartyRoomOwnershipContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyRoomRepository ownership contract', () => {
    const party = setUpWatchParty(makeSubject);
    const rooms = () => party.subject.repositories.watchPartyRooms;
    const roles = () => party.subject.repositories.watchPartyRoles;
    const current = party.room;

    describe('ownership', () => {
      beforeEach(async () => {
        await party.createRoom();
        expectOk(await roles().assign(assignment(), rolesChange(1)));
      });

      const transfer = (overrides: { fromKey?: string; expectedRolesVersion?: number } = {}) =>
        rooms().transferOwner(ROOM_ID, {
          fromKey: OWNER_KEY,
          toKey: OTHER_KEY,
          expectedRolesVersion: 1,
          cohostRoleId: roleIdOf('cohost'),
          line: lineAt(2),
          at: later(1),
          ...overrides,
        });

      it('hands the room over, leaving the previous owner Co-host and the new one no role row', async () => {
        const write = expectOk(await transfer());

        expect(write).toMatchObject({
          type: 'applied',
          room: { ownerKey: OTHER_KEY, rolesVersion: 2 },
        });
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY))).toEqual([]);
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, OWNER_KEY))).toEqual([
          assignment({
            memberKey: OWNER_KEY,
            roleId: roleIdOf('cohost'),
            grantedBy: OTHER_KEY,
            createdAt: later(1),
          }),
        ]);
        expect(await party.lineIds()).toEqual([lineId(1), lineId(2)]);
      });

      it.each([
        { scenario: 'the roles changed since', overrides: { expectedRolesVersion: 0 } },
        { scenario: 'the sender is not the owner', overrides: { fromKey: OTHER_KEY } },
      ])('is stale when $scenario, changing nothing', async ({ overrides }) => {
        const write = expectOk(await transfer(overrides));

        expect(write).toMatchObject({
          type: 'stale',
          room: { ownerKey: OWNER_KEY, rolesVersion: 1 },
        });
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY))).toHaveLength(1);
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });
    });

    describe('role upgrades', () => {
      beforeEach(async () => {
        await party.createRoom();
      });

      const upgrade = (permissions: string[]) =>
        rooms().upgradeRoles(ROOM_ID, [{ id: roleIdOf('member'), permissions }], 1, 2);
      const memberPermissions = () => party.permissionsOf('member');

      it('rewrites exactly the listed roles’ permissions and moves the registry version', async () => {
        const guestBefore = await party.permissionsOf('guest');

        expect(expectOk(await upgrade(['chat.post']))).toBe(true);

        expect(await memberPermissions()).toEqual(['chat.post']);
        expect((await current()).permissionsVersion).toBe(2);
        expect(await party.permissionsOf('guest')).toEqual(guestBefore);
      });

      it('upgrades once when two pods load the room at the same version', async () => {
        const outcomes = await Promise.all([upgrade(['chat.post']), upgrade(['queue.add'])]);

        expect(outcomes.map((outcome) => expectOk(outcome)).sort()).toEqual([false, true]);
        expect(await memberPermissions()).toHaveLength(1);
      });
    });
  });
}
