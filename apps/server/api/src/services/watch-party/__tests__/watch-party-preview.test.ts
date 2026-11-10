import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import type { PartyCaller } from '../party-caller';
import { joinRoom } from '../watch-party-join';
import { previewRoom } from '../watch-party-preview';
import {
  assignRole,
  banKey,
  fillPresence,
  GUEST_ID,
  guestSession,
  OWNER_KEY,
  seedInvite,
  seedLink,
} from './watch-party-access-fixture';
import {
  ANONYMOUS,
  MEMBER,
  OTHER,
  OWNER,
  type PartyBodyOverrides,
  guestCaller,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpPreview(body: PartyBodyOverrides = {}) {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test, body);
  const preview = async (caller: PartyCaller = ANONYMOUS, invite?: string, deps = test.deps) => {
    const loaded = expectOk(await deps.context.load(room.id, caller));
    return previewRoom(deps, loaded, invite);
  };
  const seat = async (caller: PartyCaller, joinBody?: { invite?: string }) =>
    expectOk(await joinRoom(test.deps, room.id, caller, joinBody));
  const present = async (...keys: string[]) => {
    for (const key of keys) {
      expectOk(
        await test.presence.admit(room.id, key, {
          limit: null,
          nowMs: test.clock.nowMs,
          staleBeforeMs: 0,
        })
      );
    }
  };
  return { ...test, room, preview, seat, present };
}

describe('apps/server/api/services: previewRoom', () => {
  it('shows a visitor the room, what it offers and who is watching', async () => {
    const { preview, room } = await setUpPreview();

    const view = expectOk(await preview());

    expect(view).toMatchObject({
      id: room.id,
      name: "Olivia Owner's watch party",
      features: { voice: false },
      roster: { faces: [], others: 0, discord: 0, guests: 0, total: 0 },
      viewer: {
        memberKey: null,
        permissions: [],
        roleIds: [],
        canJoin: 'yes',
        actions: ['guest', 'sign_in'],
      },
    });
  });

  it.each([
    {
      scenario: 'an account that holds no seat',
      as: userCaller(OTHER),
      expected: { memberKey: `user:${OTHER.id}`, canJoin: 'yes', actions: [] },
    },
    {
      scenario: 'the owner',
      as: userCaller(OWNER),
      expected: { memberKey: OWNER_KEY, canJoin: 'member', actions: [] },
    },
    {
      scenario: 'a guest who holds a seat',
      as: guestCaller(guestSession()),
      seated: true,
      expected: { memberKey: `guest:${GUEST_ID}`, canJoin: 'member', actions: ['sign_in'] },
    },
    {
      scenario: 'a visitor to a room with a password',
      body: { password: 'open sesame' },
      expected: { canJoin: 'password' },
    },
    {
      scenario: 'a visitor to a room without guests',
      body: { allowGuests: false },
      expected: { canJoin: 'guests_off', actions: ['sign_in'] },
    },
    {
      scenario: 'a visitor to a full room',
      body: { capacity: 10 },
      crowd: 10,
      expected: { canJoin: 'full' },
    },
    {
      scenario: 'a member of a full room',
      body: { capacity: 10 },
      crowd: 10,
      as: userCaller(OWNER),
      expected: { canJoin: 'member' },
    },
    {
      scenario: 'a banned account',
      as: userCaller(OTHER),
      banned: true,
      expected: { canJoin: 'banned' },
    },
    {
      scenario: 'a closed room',
      closed: true,
      expected: { canJoin: 'closed' },
    },
  ])(
    'tells $scenario what joining holds',
    async ({ body, as = ANONYMOUS, seated, crowd, banned, closed, expected }) => {
      const world = await setUpPreview(body);
      if (seated) await world.seat(as);
      if (crowd) await fillPresence(world, world.room.id, crowd);
      if (banned) await banKey(world, world.room.id, `user:${OTHER.id}`);
      if (closed) {
        expectOk(
          await world.repositories.watchPartyRooms.close(world.room.id, 'owner', null, new Date())
        );
      }

      const { viewer } = expectOk(await world.preview(as));

      expect(viewer).toMatchObject(expected);
    }
  );

  it('offers no guest entry where no salt can hash a guest’s address', async () => {
    const world = await setUpPreview();
    const deps = { ...world.deps, config: { ...world.deps.config, guestSalt: undefined } };

    const { viewer } = expectOk(await world.preview(ANONYMOUS, undefined, deps));

    expect(viewer.actions).toEqual(['sign_in']);
  });

  it('lists the member’s own permissions and role ids, expired ones left out', async () => {
    const world = await setUpPreview();
    await world.seat(userCaller(MEMBER));
    await assignRole(world, world.room.id, `user:${MEMBER.id}`, 'vip');

    const { viewer } = expectOk(await world.preview(userCaller(MEMBER)));

    expect(viewer.roleIds).toHaveLength(1);
    expect(viewer.permissions).toContain('chat.pin');
  });

  describe('who is watching', () => {
    it('shows faces only of accounts that allow it, and counts everyone else by kind', async () => {
      const world = await setUpPreview();
      await world.seat(userCaller(MEMBER));
      await world.seat(userCaller(OTHER));
      await world.seat(guestCaller(guestSession()));
      expectOk(
        await world.repositories.userPreferences.save({
          userId: OTHER.id,
          preferences: {
            appearance: null,
            playback: null,
            notifications: null,
            privacy: { ...DEFAULT_PREFERENCES.privacy, showInParties: false },
          },
          expectedVersion: 0,
          sections: ['privacy'],
        })
      );
      await world.present(OWNER_KEY, `user:${MEMBER.id}`, `user:${OTHER.id}`, `guest:${GUEST_ID}`);

      const { roster } = expectOk(await world.preview());

      expect(roster).toEqual({
        faces: [
          { name: 'Olivia Owner', avatarUrl: null },
          { name: 'Max Member', avatarUrl: null },
        ],
        others: 1,
        discord: 0,
        guests: 1,
        total: 4,
      });
    });

    it('shows no faces for a private room', async () => {
      const world = await setUpPreview({ visibility: 'private' });
      await world.present(OWNER_KEY);

      const { roster } = expectOk(await world.preview(userCaller(OWNER)));

      expect(roster).toMatchObject({ faces: [], others: 1, total: 1 });
    });

    it('leaves out sockets that stopped answering', async () => {
      const world = await setUpPreview();
      await world.present(OWNER_KEY);
      world.clock.advance(world.deps.config.presence.staleAfterMs + 1);

      expect(expectOk(await world.preview()).roster.total).toBe(0);
    });
  });

  describe('a private room', () => {
    it('does not exist for a stranger', async () => {
      const { preview } = await setUpPreview({ visibility: 'private' });

      expect(expectErr(await preview(userCaller(OTHER))).code).toBe(
        ErrorCodes.WATCH_PARTY_NOT_FOUND
      );
    });

    it('shows itself to a seat holder, an invitee and a link holder', async () => {
      const world = await setUpPreview({ visibility: 'private' });
      const invite = await seedInvite(world, world.room.id, OTHER);
      const token = await seedLink(world, world.room.id);

      expectOk(await world.preview(userCaller(OWNER)));
      expectOk(await world.preview(userCaller(OTHER), invite.id));
      expect(expectOk(await world.preview(userCaller(MEMBER), token)).viewer.canJoin).toBe('yes');
    });

    it('does not show itself to a revoked or expired link, or another account’s invite', async () => {
      const world = await setUpPreview({ visibility: 'private' });
      const revoked = await seedLink(world, world.room.id, { revokedAt: new Date(0) });
      const expired = await seedLink(world, world.room.id, { expiresAt: new Date(0) });
      const theirs = await seedInvite(world, world.room.id, MEMBER);

      for (const [caller, invite] of [
        [ANONYMOUS, revoked],
        [ANONYMOUS, expired],
        [userCaller(OTHER), theirs.id],
      ] as const) {
        expect(expectErr(await world.preview(caller, invite)).code).toBe(
          ErrorCodes.WATCH_PARTY_NOT_FOUND
        );
      }
    });
  });
});
