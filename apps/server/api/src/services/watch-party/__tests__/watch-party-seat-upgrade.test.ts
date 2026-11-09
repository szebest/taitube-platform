import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { upgradeSeat } from '../watch-party-seat-upgrade';
import { assignRole, banKey } from './watch-party-access-fixture';
import { guestJoined, setUpGuests } from './watch-party-guest-fixture';
import { GUEST_IP, MEMBER, OTHER, OWNER } from './watch-party-test-deps';

describe('apps/server/api/services: upgradeSeat', () => {
  async function guestWithSession() {
    const guests = await setUpGuests();
    const { joined, session } = await guestJoined(guests);
    const credential = joined.credential;
    const upgrade = (user = MEMBER, party: typeof session | null = session, token = credential) =>
      upgradeSeat(guests.deps, guests.room.id, { user, party, ip: GUEST_IP }, token);
    return { ...guests, joined, session, credential, upgrade };
  }

  it('moves the seat to the account in place and kills the guest credential', async () => {
    const world = await guestWithSession();

    const { membership } = expectOk(await world.upgrade());

    expect(membership).toMatchObject({
      kind: 'user',
      memberKey: `user:${MEMBER.id}`,
      name: 'Max Member',
      joinedVia: 'link',
    });
    expect(membership.permissions).toContain('chat.post');
    expect((await world.seated()).map(({ memberKey }) => memberKey)).toEqual([
      `user:${OWNER.id}`,
      `user:${MEMBER.id}`,
    ]);
    expect(expectOk(await world.guestSessions.resolve(world.credential, 60))).toBeNull();
  });

  it('tells the guest’s own socket who it is now', async () => {
    const world = await guestWithSession();

    expectOk(await world.upgrade());

    expect(world.frames()).toEqual([
      expect.objectContaining({
        memberKey: world.joined.membership.memberKey,
        frame: { type: 'you', memberKey: `user:${MEMBER.id}`, kind: 'user', roleIds: [] },
      }),
    ]);
  });

  it('carries roles the seat held to the account', async () => {
    const world = await guestWithSession();
    await assignRole(world, world.room.id, world.joined.membership.memberKey, 'vip');

    const { membership } = expectOk(await world.upgrade());

    expect(membership.roleIds).toHaveLength(1);
  });

  it('seats an account that already held a seat once, with the older seat superseded', async () => {
    const world = await guestWithSession();
    expectOk(
      await upgradeSeat(
        world.deps,
        world.room.id,
        { user: OWNER, party: world.session, ip: GUEST_IP },
        world.credential
      )
    );

    expect((await world.seated()).map(({ memberKey }) => memberKey)).toEqual([`user:${OWNER.id}`]);
  });

  it.each([
    { scenario: 'an account that is banned here', ban: 'account' },
    { scenario: 'a guest whose address is banned', ban: 'address' },
  ])('refuses $scenario and gives up the guest seat', async ({ ban }) => {
    const world = await guestWithSession();
    await banKey(
      world,
      world.room.id,
      ban === 'account' ? `user:${MEMBER.id}` : 'guest:anothercredential0',
      ban === 'account' ? null : `ip:${world.room.id}:${GUEST_IP}`
    );

    expect(expectErr(await world.upgrade()).code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    expect((await world.seated()).map(({ memberKey }) => memberKey)).toEqual([`user:${OWNER.id}`]);
  });

  it.each([
    {
      scenario: 'a guest credential without a session',
      user: null,
      code: ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID,
    },
    {
      scenario: 'a session without a guest credential',
      party: false,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    { scenario: 'a guest whose seat is gone', left: true, code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
    { scenario: 'neither credential', user: null, party: false, code: ErrorCodes.UNAUTHORIZED },
  ])(
    'refuses $scenario with $code',
    async ({ user = MEMBER, party = true, left = false, code }) => {
      const world = await guestWithSession();
      if (left) {
        expectOk(
          await world.repositories.watchPartyMembers.leave(
            world.room.id,
            world.joined.membership.memberKey,
            null,
            new Date()
          )
        );
      }

      const caller = { user, party: party ? world.session : null, ip: GUEST_IP };
      const result = await upgradeSeat(
        world.deps,
        world.room.id,
        caller,
        party ? world.credential : null
      );

      expect(expectErr(result).code).toBe(code);
    }
  );

  it('is refused for a room nobody can see', async () => {
    const world = await guestWithSession();

    const result = await upgradeSeat(
      world.deps,
      '018f0000-0000-7000-8000-0000000000ff',
      { user: OTHER, party: world.session, ip: GUEST_IP },
      world.credential
    );

    expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });
});
