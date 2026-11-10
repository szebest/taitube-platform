import { WATCH_PARTY_PERMISSION_IDS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import {
  FRIENDS_MEMBER,
  permissionsOf,
  popcorn,
  PUBLIC_MEMBER,
  setUpRoles,
  sortedKeys,
} from './watch-party-role-party';
import { MEMBER, OTHER, userCaller } from './watch-party-test-deps';

describe('applyPreset', () => {
  it.each([
    { from: 'friends', preset: 'public', member: PUBLIC_MEMBER },
    { from: 'public', preset: 'friends', member: FRIENDS_MEMBER },
  ] as const)(
    'turns a $from room into $preset: Member only, and edits made since are reset',
    async ({ from, preset, member }) => {
      const setup = await setUpRoles(from);
      const { service, owner, ids, frames } = setup;
      const custom = expectOk(await service.create(ROOM_ID, owner, popcorn));
      expectOk(await service.assign(ROOM_ID, owner, keyOf(OTHER), custom.id, undefined));
      const dj = (await setup.roles()).items.find((role) => role.id === ids.dj);
      expectOk(
        await service.update(ROOM_ID, owner, ids.dj, {
          permissions: ['chat.pin'],
          updatedAt: dj?.updatedAt ?? '',
        })
      );
      const before = frames().length;

      const applied = expectOk(await service.applyPreset(ROOM_ID, owner, { preset }));

      expect(sortedKeys(await permissionsOf(setup, 'member'))).toEqual(sortedKeys(member));
      expect(await permissionsOf(setup, 'dj')).toContain('playback.control');
      expect(applied.items.map(({ id }) => id)).toContain(custom.id);
      expect(
        (await setup.roles()).items.find((role) => role.id === custom.id)?.permissions
      ).toEqual(['chat.pin']);
      expect(
        expectOk(await setup.repositories.watchPartyRoles.assignmentsOf(ROOM_ID, keyOf(OTHER)))
      ).toHaveLength(1);
      expect(await permissionsOf(setup, 'owner')).toHaveLength(WATCH_PARTY_PERMISSION_IDS.length);
      expect(frames().slice(before)).toHaveLength(1);
    }
  );

  it.each([
    { scenario: 'a member', caller: userCaller(MEMBER) },
    { scenario: 'a Co-host, who lacks roles.manage', caller: userCaller(OTHER) },
  ])('refuses $scenario', async ({ caller }) => {
    const { service, ids, owner } = await setUpRoles();
    expectOk(await service.assign(ROOM_ID, owner, keyOf(OTHER), ids.cohost, undefined));

    const failure = expectErr(await service.applyPreset(ROOM_ID, caller, { preset: 'public' }));

    expect(failure).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
      permission: 'roles.manage',
    });
  });
});
