import { expectErr, expectOk } from '@kit/testing/result';
import { WATCH_PARTY_PERMISSIONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { WatchPartyContextLoader } from '../watch-party-context';
import { createRole, OWNER_KEY } from './watch-party-access-fixture';
import {
  ANONYMOUS,
  MEMBER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUp() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test);
  return { ...test, room, loader: test.deps.context };
}

describe('WatchPartyContextLoader', () => {
  it('refuses a room that does not exist', async () => {
    const { loader } = await setUp();

    const failure = expectErr(
      await loader.load('018f0000-0000-7000-8000-0000000000ff', userCaller(OWNER))
    );

    expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it('gives the owner the seat, the ownership and every permission', async () => {
    const { loader, room } = await setUp();

    const context = expectOk(await loader.load(room.id, userCaller(OWNER)));

    expect(context).toMatchObject({ isOwner: true, kind: 'user', seat: expect.anything() });
    expect(context.effective.permissions).toContain('roles.manage');
  });

  it.each([
    { who: 'a signed-in account with no seat', caller: userCaller(MEMBER), kind: 'user' },
    { who: 'a caller with no identity', caller: ANONYMOUS, kind: null },
  ])('gives $who no seat and no permission', async ({ caller, kind }) => {
    const { loader, room } = await setUp();

    const context = expectOk(await loader.load(room.id, caller));

    expect(context).toMatchObject({ isOwner: false, seat: null, kind });
    expect(context.effective.permissions).toEqual([]);
  });

  describe('extending the registry', () => {
    const registryV2 = WATCH_PARTY_PERMISSIONS.map((entry) =>
      entry.id === 'queue.vote' ? { ...entry, since: 2 } : entry
    );

    async function versionOneRoom() {
      const world = await setUp();
      const { watchPartyRoles, watchPartyRooms } = world.repositories;
      const at = world.deps.now();
      const builtIns = expectOk(await watchPartyRoles.list(world.room.id, at));
      const withoutVote = (key: 'cohost' | 'member') => ({
        key,
        permissions:
          builtIns
            .find((role) => role.key === key)
            ?.permissions.filter((id) => id !== 'queue.vote') ?? [],
      });
      expectOk(
        await watchPartyRoles.resetBuiltIns(
          world.room.id,
          (['cohost', 'member'] as const).map(withoutVote),
          {
            at,
            line: {
              id: world.deps.secrets.newId(),
              line: { event: 'roles_changed', actorKey: OWNER_KEY, targetKey: null, detail: null },
              videoId: null,
              positionMs: null,
              createdAt: at,
            },
          }
        )
      );
      const custom = await createRole(world, world.room.id, {
        name: 'Crew',
        position: 450,
        permissions: ['chat.pin'],
      });
      const permissionsOf = async (key: string) =>
        expectOk(await watchPartyRoles.list(world.room.id, at)).find(
          (role) => role.key === key || role.id === key
        )?.permissions;
      const version = async () =>
        expectOk(await watchPartyRooms.findById(world.room.id))?.permissionsVersion;
      const loader = new WatchPartyContextLoader(world.deps, registryV2);
      return { ...world, custom, permissionsOf, version, loader };
    }

    it('upgrades a version 1 room on load, built-in roles by their defaults and custom roles without', async () => {
      const world = await versionOneRoom();
      expect(await world.version()).toBe(1);

      expectOk(await world.loader.load(world.room.id, userCaller(OWNER)));

      expect(await world.version()).toBe(2);
      expect(await world.permissionsOf('cohost')).toContain('queue.vote');
      expect(await world.permissionsOf('member')).toContain('queue.vote');
      expect(await world.permissionsOf(world.custom)).toEqual(['chat.pin']);
    });

    it('upgrades once: a second load changes nothing', async () => {
      const world = await versionOneRoom();
      expectOk(await world.loader.load(world.room.id, userCaller(OWNER)));
      const before = await world.permissionsOf('member');

      expectOk(await world.loader.load(world.room.id, userCaller(OWNER)));

      expect(await world.permissionsOf('member')).toEqual(before);
      expect(await world.version()).toBe(2);
    });
  });
});
