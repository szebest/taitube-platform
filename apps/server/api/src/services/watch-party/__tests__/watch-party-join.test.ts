import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { joinRoom, leaveRoom } from '../watch-party-join';
import {
  assignRole,
  banKey,
  GUEST_KEY,
  guestSession,
  seedInvite,
  seedLink,
} from './watch-party-access-fixture';
import { PASSWORD, setUpJoin } from './watch-party-join-fixture';
import {
  ANONYMOUS,
  DISCORD_ID,
  discordSession,
  guestCaller,
  MEMBER,
  OTHER,
  OWNER,
  userCaller,
} from './watch-party-test-deps';

describe('apps/server/api/services: joinRoom', () => {
  it.each([
    {
      scenario: 'an account joining by the link',
      body: {},
      as: userCaller(MEMBER),
      expected: {
        kind: 'user',
        joinedVia: 'link',
        memberKey: `user:${MEMBER.id}`,
        name: 'Max Member',
      },
    },
    {
      scenario: 'a guest credential on a room that lets guests in',
      body: {},
      as: guestCaller(guestSession()),
      expected: {
        kind: 'guest',
        joinedVia: 'link',
        memberKey: GUEST_KEY,
        permissions: ['voice.join'],
      },
    },
    {
      scenario: 'a Discord member',
      body: {},
      as: guestCaller(discordSession()),
      expected: { kind: 'discord', memberKey: `discord:${DISCORD_ID}`, name: 'Discord Dana' },
    },
  ])('seats $scenario as $expected.kind', async ({ body, as, expected }) => {
    const { join } = await setUpJoin(body);

    expect(expectOk(await join(as)).membership).toMatchObject(expected);
  });

  it('gives an account Member’s permissions and nothing more', async () => {
    const { join } = await setUpJoin();

    const { membership } = expectOk(await join());

    expect(membership.permissions).toContain('playback.control');
    expect(membership.permissions).not.toContain('room.edit');
    expect(membership.roleIds).toEqual([]);
  });

  it('writes one joined line and none for a member who joins again', async () => {
    const { join, lines } = await setUpJoin();

    await join();
    await join();

    expect((await lines()).filter(({ system }) => system?.event === 'joined')).toHaveLength(1);
  });

  it('lets the owner back in to their own room', async () => {
    const { join } = await setUpJoin();

    expect(expectOk(await join(userCaller(OWNER))).membership).toMatchObject({
      joinedVia: 'owner',
    });
  });

  it('carries a returning member’s roles into the answer', async () => {
    const test = await setUpJoin();
    await test.join();
    await assignRole(test, test.room.id, `user:${MEMBER.id}`, 'vip');

    const { membership } = expectOk(await test.join());

    expect(membership.roleIds).toHaveLength(1);
  });

  describe('grants', () => {
    it('lets the invitee of a private room in, marks the invite joined, and skips the password', async () => {
      const test = await setUpJoin({ visibility: 'private', password: PASSWORD });
      const invite = await seedInvite(test, test.room.id, MEMBER);

      const { membership } = expectOk(await test.join(userCaller(MEMBER), { invite: invite.id }));

      expect(membership.joinedVia).toBe('invite');
      expect(expectOk(await test.repositories.watchPartyInvites.findById(invite.id))?.status).toBe(
        'joined'
      );
    });

    it('lets an invite link holder in, counts a use, and skips the password', async () => {
      const test = await setUpJoin({ visibility: 'private', password: PASSWORD });
      const token = await seedLink(test, test.room.id, { maxUses: 2 });

      const { membership } = expectOk(await test.join(userCaller(MEMBER), { invite: token }));

      expect(membership.joinedVia).toBe('invite_link');
      const link = expectOk(
        await test.repositories.watchPartyInviteLinks.findByTokenHash(
          test.deps.secrets.hashToken(token)
        )
      );
      expect(link?.uses).toBe(1);
    });

    it('does not spend a link use on a member already inside', async () => {
      const test = await setUpJoin({ visibility: 'private' });
      const token = await seedLink(test, test.room.id);
      await test.join(userCaller(MEMBER), { invite: token });

      await test.join(userCaller(MEMBER), { invite: token });

      const link = expectOk(
        await test.repositories.watchPartyInviteLinks.findByTokenHash(
          test.deps.secrets.hashToken(token)
        )
      );
      expect(link?.uses).toBe(1);
    });

    it.each([
      { scenario: 'revoked', link: { revokedAt: new Date(0) } },
      { scenario: 'expired', link: { expiresAt: new Date(0) } },
      { scenario: 'spent', link: { maxUses: 1, uses: 1 } },
    ])('refuses a $scenario link and seats nobody', async ({ link }) => {
      const test = await setUpJoin({ visibility: 'private' });
      const token = await seedLink(test, test.room.id, link);

      const failure = expectErr(await test.join(userCaller(MEMBER), { invite: token }));

      expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
      expect(await test.seated()).toEqual([`user:${OWNER.id}`]);
    });

    it('refuses an invite that belongs to someone else', async () => {
      const test = await setUpJoin({ visibility: 'private' });
      const invite = await seedInvite(test, test.room.id, OTHER);

      const failure = expectErr(await test.join(userCaller(MEMBER), { invite: invite.id }));

      expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
    });
  });

  describe('refusals', () => {
    it.each([
      { scenario: 'a signed-out caller', as: ANONYMOUS, code: ErrorCodes.UNAUTHORIZED },
      {
        scenario: 'a guest on a room without guests',
        body: { allowGuests: false },
        as: guestCaller(guestSession()),
        code: ErrorCodes.WATCH_PARTY_GUESTS_OFF,
      },
      {
        scenario: 'a stranger to a private room',
        body: { visibility: 'private' as const },
        code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
      },
      {
        scenario: 'a room that asks for a password and gets none',
        body: { password: PASSWORD },
        code: ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
      },
      {
        scenario: 'a wrong password',
        body: { password: PASSWORD },
        joinBody: { password: 'not it at all' },
        code: ErrorCodes.WATCH_PARTY_PASSWORD_INVALID,
      },
    ])('refuses $scenario with $code', async ({ body, as, joinBody, code }) => {
      const { join } = await setUpJoin(body);

      expect(expectErr(await join(as, joinBody)).code).toBe(code);
    });

    it('refuses a room that does not exist', async () => {
      const test = await setUpJoin();

      const result = await joinRoom(
        test.deps,
        '018f0000-0000-7000-8000-0000000000ff',
        userCaller(MEMBER),
        undefined
      );

      expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
    });

    it('refuses a closed room', async () => {
      const test = await setUpJoin();
      expectOk(
        await test.repositories.watchPartyRooms.close(test.room.id, 'owner', null, new Date())
      );

      expect(expectErr(await test.join()).code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
    });

    it.each([
      { grant: 'a password', password: PASSWORD },
      { grant: 'an invite', invited: true },
      { grant: 'an invite link', linked: true },
    ])('refuses a banned member who arrives with $grant', async ({ password, invited, linked }) => {
      const test = await setUpJoin({ visibility: 'private', password: PASSWORD });
      await banKey(test, test.room.id, `user:${MEMBER.id}`);
      const invite = invited ? (await seedInvite(test, test.room.id, MEMBER)).id : undefined;
      const token = linked ? await seedLink(test, test.room.id) : undefined;

      const result = await test.join(userCaller(MEMBER), {
        password,
        invite: invite ?? token,
      });

      expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    });

    it.each([
      {
        scenario: 'a Discord member banned by key',
        as: guestCaller(discordSession()),
        key: `discord:${DISCORD_ID}`,
        ipHash: null,
      },
      {
        scenario: 'a guest banned by address',
        as: guestCaller(guestSession('guestbbbbbbbbbbbbbbbb')),
        key: 'guest:someoneelse0000000',
        ipHash: 'ip:guest',
      },
    ])('refuses $scenario whichever credential arrives', async ({ as, key, ipHash }) => {
      const test = await setUpJoin();
      await banKey(test, test.room.id, key, ipHash);

      expect(expectErr(await test.join(as)).code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    });
  });
});

describe('apps/server/api/services: leaveRoom', () => {
  it('gives up the seat, writes a left line and drops the presence', async () => {
    const test = await setUpJoin();
    await test.join();
    expectOk(
      await test.presence.admit(test.room.id, `user:${MEMBER.id}`, {
        limit: null,
        nowMs: test.clock.nowMs,
        staleBeforeMs: 0,
      })
    );

    expectOk(await leaveRoom(test.deps, test.room.id, userCaller(MEMBER)));

    expect(await test.seated()).toEqual([`user:${OWNER.id}`]);
    expect((await test.lines()).map(({ system }) => system?.event)).toContain('left');
    expect(expectOk(await test.presence.members(test.room.id, 0))).toEqual([]);
  });

  it.each([
    { scenario: 'a signed-out caller', as: ANONYMOUS, code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'someone who holds no seat',
      as: userCaller(OTHER),
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
  ])('refuses $scenario with $code', async ({ as, code }) => {
    const test = await setUpJoin();

    expect(expectErr(await leaveRoom(test.deps, test.room.id, as)).code).toBe(code);
  });
});
