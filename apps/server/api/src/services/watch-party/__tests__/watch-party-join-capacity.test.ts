import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  assignRole,
  fillPresence,
  guestSession,
  seedInvite,
  seedLink,
} from './watch-party-access-fixture';
import { setUpJoin } from './watch-party-join-fixture';
import { guestCaller, MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

describe('apps/server/api/services: joinRoom capacity', () => {
  const FULL = ErrorCodes.WATCH_PARTY_FULL;

  it('admits up to the operator ceiling when no capacity is set, then refuses', async () => {
    const test = await setUpJoin({}, { config: { watchParties: { maxMembers: 3 } } });
    await fillPresence(test, test.room.id, 2);

    expectOk(await test.join(userCaller(MEMBER)));
    await fillPresence(test, test.room.id, 3);

    expect(expectErr(await test.join(userCaller(OTHER)))).toMatchObject({
      code: FULL,
      present: 3,
      capacity: 3,
    });
  });

  it.each([
    { who: 'a member', as: userCaller(OTHER) },
    { who: 'a guest', as: guestCaller(guestSession()) },
  ])('refuses $who when the room is full', async ({ as }) => {
    const test = await setUpJoin({ capacity: 10 });
    await fillPresence(test, test.room.id, 10);

    expect(expectErr(await test.join(as))).toMatchObject({
      code: FULL,
      present: 10,
      capacity: 10,
    });
  });

  it.each([
    { who: 'an invitee', via: 'invite' },
    { who: 'an invite link holder', via: 'link' },
  ])('refuses $who when the room is full, and keeps the grant unspent', async ({ via }) => {
    const test = await setUpJoin({ visibility: 'private', capacity: 10 });
    await fillPresence(test, test.room.id, 10);
    const invite =
      via === 'invite'
        ? (await seedInvite(test, test.room.id, MEMBER)).id
        : await seedLink(test, test.room.id, { maxUses: 1 });

    expect(expectErr(await test.join(userCaller(MEMBER), { invite })).code).toBe(FULL);

    expect(
      via === 'invite'
        ? expectOk(await test.repositories.watchPartyInvites.findById(invite))?.status
        : expectOk(
            await test.repositories.watchPartyInviteLinks.findByTokenHash(
              test.deps.secrets.hashToken(invite)
            )
          )?.uses
    ).toBe(via === 'invite' ? 'pending' : 0);
  });

  it.each([{ role: 'moderator' as const }, { role: 'vip' as const }])(
    'admits a $role above the capacity',
    async ({ role }) => {
      const test = await setUpJoin({ capacity: 10 });
      await fillPresence(test, test.room.id, 10);
      await assignRole(test, test.room.id, `user:${MEMBER.id}`, role);

      expectOk(await test.join(userCaller(MEMBER)));
    }
  );

  it('admits the owner at the ceiling', async () => {
    const test = await setUpJoin({}, { config: { watchParties: { maxMembers: 3 } } });
    await fillPresence(test, test.room.id, 3);

    expectOk(await test.join(userCaller(OWNER)));
  });

  it('admits a member who already holds a socket', async () => {
    const test = await setUpJoin({ capacity: 10 });
    await fillPresence(test, test.room.id, 9);
    expectOk(
      await test.presence.admit(test.room.id, `user:${MEMBER.id}`, {
        limit: null,
        nowMs: test.clock.nowMs,
        staleBeforeMs: 0,
      })
    );

    expectOk(await test.join(userCaller(MEMBER)));
  });

  it.each([
    { present: 12, admitted: false },
    { present: 10, admitted: false },
    { present: 9, admitted: true },
  ])(
    'after the limit drops from 12 to 10, $present present admits: $admitted',
    async ({ present, admitted }) => {
      const test = await setUpJoin({ capacity: 12 });
      await fillPresence(test, test.room.id, 12);
      expectOk(
        await test.repositories.watchPartyRooms.updateSettings(
          test.room.id,
          { capacity: 10 },
          test.room.version,
          null,
          test.deps.now()
        )
      );
      for (let index = 11; index >= present; index -= 1) {
        expectOk(await test.presence.leave(test.room.id, `user:filler-${index}`));
      }

      const result = await test.join(userCaller(MEMBER));

      expect(result.ok).toBe(admitted);
    }
  );

  it('stops counting sockets that stopped answering', async () => {
    const test = await setUpJoin({ capacity: 10 });
    await fillPresence(test, test.room.id, 10);

    test.clock.advance(test.deps.config.presence.staleAfterMs + 1);

    expectOk(await test.join(userCaller(MEMBER)));
  });
});
