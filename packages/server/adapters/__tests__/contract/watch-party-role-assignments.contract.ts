import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject } from './subjects';
import {
  AT,
  assignment,
  CUSTOM_ROLE_ID,
  customRole,
  later,
  OTHER_KEY,
  OWNER_KEY,
  ROOM_ID,
  roleIdOf,
  rolesChange,
  setUpWatchParty,
} from './watch-party-fixtures';

export function describeWatchPartyRoleAssignmentsContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyRoleRepository assignments contract', () => {
    const party = setUpWatchParty(makeSubject);
    const roles = () => party.subject.repositories.watchPartyRoles;

    beforeEach(async () => {
      await party.createRoom();
    });

    describe('removing, resetting and assigning', () => {
      it('removes a role together with its holders', async () => {
        expectOk(await roles().create(customRole(), rolesChange(1)));
        expectOk(await roles().assign(assignment({ roleId: CUSTOM_ROLE_ID }), rolesChange(2)));

        expect(
          expectOk(await roles().remove(ROOM_ID, CUSTOM_ROLE_ID, rolesChange(3)))
        ).toMatchObject({
          type: 'applied',
        });

        expect((await party.roleList()).some(({ id }) => id === CUSTOM_ROLE_ID)).toBe(false);
        expect(expectOk(await roles().assignmentsIn(ROOM_ID))).toEqual([]);
        expect(expectOk(await roles().remove(ROOM_ID, CUSTOM_ROLE_ID, rolesChange(4)))).toEqual({
          type: 'missing',
        });
      });

      it('resets only the built-in roles it names, leaving custom roles and holders alone', async () => {
        expectOk(await roles().create(customRole(), rolesChange(1)));
        expectOk(await roles().assign(assignment({ roleId: CUSTOM_ROLE_ID }), rolesChange(2)));
        const moderator = await party.permissionsOf('moderator');

        expectOk(
          await roles().resetBuiltIns(
            ROOM_ID,
            [
              { key: 'member', permissions: ['chat.post'] },
              { key: 'dj', permissions: [] },
            ],
            rolesChange(3)
          )
        );

        expect(await party.permissionsOf('member')).toEqual(['chat.post']);
        expect(await party.permissionsOf('dj')).toEqual([]);
        expect(await party.permissionsOf('moderator')).toEqual(moderator);
        expect(
          (await party.roleList()).find(({ id }) => id === CUSTOM_ROLE_ID)?.permissions
        ).toEqual(['chat.pin']);
        expect(expectOk(await roles().assignmentsIn(ROOM_ID))).toHaveLength(1);
      });

      it('replaces the expiry and granter of a role already held, and revokes it once', async () => {
        expectOk(await roles().assign(assignment({ expiresAt: later(10) }), rolesChange(1)));

        const repeat = expectOk(
          await roles().assign(
            assignment({ expiresAt: null, grantedBy: OTHER_KEY, createdAt: later(5) }),
            rolesChange(2)
          )
        );

        expect(repeat).toMatchObject({
          type: 'applied',
          value: { expiresAt: null, grantedBy: OTHER_KEY },
        });
        expect(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY))).toHaveLength(1);
        const revoke = () => roles().revoke(ROOM_ID, OTHER_KEY, roleIdOf('dj'), rolesChange(3));
        expect(expectOk(await revoke())).toMatchObject({ type: 'applied' });
        expect(expectOk(await revoke())).toEqual({ type: 'missing' });
      });
    });

    describe('reading assignments and sweeping expired ones', () => {
      beforeEach(async () => {
        expectOk(await roles().assign(assignment({ expiresAt: later(-5) }), rolesChange(1)));
        expectOk(await roles().assign(assignment({ roleId: roleIdOf('vip') }), rolesChange(2)));
        expectOk(await roles().assign(assignment({ memberKey: OWNER_KEY }), rolesChange(3)));
      });

      const roleIdsOf = (rows: readonly { roleId: string }[]) =>
        rows.map((row) => row.roleId).sort();

      it('reads a room’s rows, or one member’s, expired ones included', async () => {
        expect(expectOk(await roles().assignmentsIn(ROOM_ID))).toHaveLength(3);
        expect(roleIdsOf(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY)))).toEqual(
          [roleIdOf('dj'), roleIdOf('vip')].sort()
        );
      });

      it('deletes the rows that expired by now without touching roles_version', async () => {
        expect(expectOk(await roles().deleteExpired(AT))).toBe(1);

        expect(roleIdsOf(expectOk(await roles().assignmentsOf(ROOM_ID, OTHER_KEY)))).toEqual([
          roleIdOf('vip'),
        ]);
        expect(await party.rolesVersion()).toBe(3);
        expect(expectOk(await roles().deleteExpired(AT))).toBe(0);
      });
    });
  });
}
