import { expectOk } from '@vp/testing/result';
import { resolvePeople } from '../watch-party-names';
import { MEMBER, OTHER, OWNER, seedParty, watchPartyTestDeps } from './watch-party-test-deps';

describe('apps/server/api/services: resolvePeople', () => {
  it.each([
    {
      scenario: 'an account by its channel, whatever its seat kept',
      key: `user:${MEMBER.id}`,
      snapshots: { [`user:${MEMBER.id}`]: { displayName: 'Stale', avatarUrl: null } },
      expected: { name: 'Max Member', avatarUrl: null },
    },
    {
      scenario: 'a Discord member by the snapshot of its seat',
      key: 'discord:123456789012345678',
      snapshots: {
        'discord:123456789012345678': {
          displayName: 'Dana',
          avatarUrl: 'https://cdn.example/dana.png',
        },
      },
      expected: { name: 'Dana', avatarUrl: 'https://cdn.example/dana.png' },
    },
    {
      scenario: 'a guest by its generated name',
      key: 'guest:abcdefghijklmnop',
      snapshots: { 'guest:abcdefghijklmnop': { displayName: 'Guest 4821', avatarUrl: null } },
      expected: { name: 'Guest 4821', avatarUrl: null },
    },
    {
      scenario: 'someone with neither',
      key: 'guest:nobodyknowsthem000',
      snapshots: {},
      expected: { name: 'Member', avatarUrl: null },
    },
  ])('names $scenario', async ({ key, snapshots, expected }) => {
    const test = watchPartyTestDeps();
    await seedParty(test);

    const personOf = expectOk(
      await resolvePeople(test.repositories.channels, [key], new Map(Object.entries(snapshots)))
    );

    expect(personOf(key)).toEqual({ memberKey: key, ...expected });
  });

  it('names every account in the list by its own channel', async () => {
    const test = watchPartyTestDeps();
    await seedParty(test);

    const personOf = expectOk(
      await resolvePeople(test.repositories.channels, [`user:${OWNER.id}`, `user:${OTHER.id}`])
    );

    expect([personOf(`user:${OWNER.id}`).name, personOf(`user:${OTHER.id}`).name]).toEqual([
      'Olivia Owner',
      'Oscar Other',
    ]);
  });
});
