import type { WatchPartyRoleRepositoryPort } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject } from './subjects';
import {
  AT,
  assignment,
  CUSTOM_ROLE_ID,
  customRole,
  later,
  lineId,
  OTHER_KEY,
  OTHER_ROOM_ID,
  ROOM_ID,
  roleId,
  roleIdOf,
  rolesChange,
  setUpWatchParty,
  UNKNOWN_ROOM_ID,
} from './watch-party-fixtures';
import { describeWatchPartyRoleAssignmentsContract } from './watch-party-role-assignments.contract';

type Run = (roles: WatchPartyRoleRepositoryPort, roomId: string) => Promise<{ type: string }>;

const WRITES: readonly { name: string; run: Run }[] = [
  {
    name: 'create',
    run: async (roles, roomId) =>
      expectOk(
        await roles.create(
          customRole({ id: roleId(51), roomId, name: 'Second', position: 460 }),
          rolesChange(10)
        )
      ),
  },
  {
    name: 'update',
    run: async (roles, roomId) =>
      expectOk(await roles.update(roomId, CUSTOM_ROLE_ID, { name: 'Edited' }, AT, rolesChange(10))),
  },
  {
    name: 'remove',
    run: async (roles, roomId) =>
      expectOk(await roles.remove(roomId, CUSTOM_ROLE_ID, rolesChange(10))),
  },
  {
    name: 'resetBuiltIns',
    run: async (roles, roomId) =>
      expectOk(
        await roles.resetBuiltIns(
          roomId,
          [{ key: 'dj', permissions: ['chat.post'] }],
          rolesChange(10)
        )
      ),
  },
  {
    name: 'assign',
    run: async (roles, roomId) =>
      expectOk(await roles.assign(assignment({ roomId, roleId: CUSTOM_ROLE_ID }), rolesChange(10))),
  },
  {
    name: 'revoke',
    run: async (roles, roomId) =>
      expectOk(await roles.revoke(roomId, OTHER_KEY, roleIdOf('dj'), rolesChange(10))),
  },
];

export function describeWatchPartyRoleRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyRoleRepository contract', () => {
    const party = setUpWatchParty(makeSubject);
    const roles = () => party.subject.repositories.watchPartyRoles;
    beforeEach(async () => {
      await party.createRoom();
    });

    it('lists the built-in roles highest position first, with their permissions', async () => {
      const found = await party.roleList();

      expect(found.map(({ position }) => position)).toEqual(
        [...found.map(({ position }) => position)].sort((a, b) => b - a)
      );
      expect(found[0]).toMatchObject({ id: roleIdOf('owner'), key: 'owner', memberCount: 0 });
      expect(expectOk(await roles().list(OTHER_ROOM_ID, AT))).toEqual([]);
    });

    it.each([
      { scenario: 'no expiry', expiresAt: null, memberCount: 1 },
      { scenario: 'an expiry in the future', expiresAt: later(10), memberCount: 1 },
      { scenario: 'an expiry exactly now', expiresAt: AT, memberCount: 0 },
      { scenario: 'an expiry in the past', expiresAt: later(-10), memberCount: 0 },
    ])('counts a holder with $scenario as $memberCount', async ({ expiresAt, memberCount }) => {
      expectOk(await roles().assign(assignment({ expiresAt }), rolesChange(1)));

      const dj = (await party.roleList()).find(({ key }) => key === 'dj');

      expect(dj?.memberCount).toBe(memberCount);
    });

    it.each(WRITES)('$name bumps roles_version and writes its line', async ({ run }) => {
      expectOk(await roles().create(customRole(), rolesChange(1)));
      expectOk(await roles().assign(assignment(), rolesChange(2)));
      expect(await party.rolesVersion()).toBe(2);

      const write = await run(roles(), ROOM_ID);

      expect(write).toMatchObject({ type: 'applied', rolesVersion: 3 });
      expect(await party.rolesVersion()).toBe(3);
      expect(await party.lineIds()).toEqual([lineId(1), lineId(2), lineId(10)]);
    });

    it.each(WRITES)(
      '$name answers missing for an unknown room, writing nothing',
      async ({ run }) => {
        expectOk(await roles().assign(assignment(), rolesChange(1)));

        const write = await run(roles(), UNKNOWN_ROOM_ID);

        expect(write).toEqual({ type: 'missing' });
        expect(await party.lineIds()).toEqual([lineId(1)]);
      }
    );

    describe('creating', () => {
      it('stores the role with its permissions at the change time', async () => {
        const write = expectOk(await roles().create(customRole(), rolesChange(1, later(1))));

        expect(write).toMatchObject({
          type: 'applied',
          value: {
            id: CUSTOM_ROLE_ID,
            permissions: ['chat.pin'],
            createdAt: later(1),
            updatedAt: later(1),
          },
        });
        expect(
          (await party.roleList()).find(({ id }) => id === CUSTOM_ROLE_ID)?.permissions
        ).toEqual(['chat.pin']);
      });

      it.each([
        { scenario: 'position', overrides: { position: 400 } },
        { scenario: 'built-in key', overrides: { key: 'dj' as const, position: 460 } },
      ])('conflicts on a taken $scenario, changing nothing', async ({ overrides }) => {
        const write = expectOk(await roles().create(customRole(overrides), rolesChange(1)));

        expect(write).toEqual({ type: 'conflict' });
        expect(await party.rolesVersion()).toBe(0);
        expect(await party.lineIds()).toEqual([]);
      });
    });

    describe('editing', () => {
      beforeEach(async () => {
        expectOk(await roles().create(customRole(), rolesChange(1)));
      });

      it.each([
        {
          scenario: 'applies every field and replaces the permissions',
          roleId: CUSTOM_ROLE_ID,
          patch: {
            name: 'Edited',
            colour: '#ffffff',
            position: 455,
            permissions: ['queue.add'] as const,
          },
          expectedUpdatedAt: AT,
          rolesVersion: 2,
          expected: {
            type: 'applied',
            value: {
              name: 'Edited',
              colour: '#ffffff',
              position: 455,
              permissions: ['queue.add'],
              updatedAt: later(3),
            },
          },
        },
        {
          scenario: 'keeps what the patch leaves out',
          roleId: CUSTOM_ROLE_ID,
          patch: { name: 'Edited' },
          expectedUpdatedAt: AT,
          rolesVersion: 2,
          expected: {
            type: 'applied',
            value: { name: 'Edited', position: 450, permissions: ['chat.pin'] },
          },
        },
        {
          scenario: 'conflicts when the editor read an older version',
          roleId: CUSTOM_ROLE_ID,
          patch: { name: 'Edited' },
          expectedUpdatedAt: later(-1),
          rolesVersion: 1,
          expected: { type: 'conflict' },
        },
        {
          scenario: 'conflicts on a position another role holds',
          roleId: CUSTOM_ROLE_ID,
          patch: { position: 400 },
          expectedUpdatedAt: AT,
          rolesVersion: 1,
          expected: { type: 'conflict' },
        },
        {
          scenario: 'answers missing for an unknown role',
          roleId: roleId(99),
          patch: { name: 'Edited' },
          expectedUpdatedAt: AT,
          rolesVersion: 1,
          expected: { type: 'missing' },
        },
      ])(
        '$scenario',
        async ({
          roleId: id,
          patch,
          expectedUpdatedAt,
          rolesVersion: expectedVersion,
          expected,
        }) => {
          const write = expectOk(
            await roles().update(ROOM_ID, id, patch, expectedUpdatedAt, rolesChange(2, later(3)))
          );

          expect(write).toMatchObject(expected);
          expect(await party.rolesVersion()).toBe(expectedVersion);
        }
      );
    });

    describeWatchPartyRoleAssignmentsContract(makeSubject);
  });
}
