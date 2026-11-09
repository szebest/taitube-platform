import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  ABSENT_KEY,
  ESCALATION,
  KEEPER,
  linesOf,
  MISSING,
  NOT_FOUND,
  roomOf,
  seatOf,
  setUpParty,
} from './watch-party-member-party';
import { GUEST_IP_HASH, GUEST_KEY, keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

describe('ban and unban', () => {
  it('bans a guest by key and by the address the seat kept, and tells them', async () => {
    const party = await setUpParty([['moderator', OTHER]]);
    const { service, repositories, frames } = party;

    const banned = await service.ban(ROOM_ID, userCaller(OTHER), GUEST_KEY, { reason: 'spam' });

    expect(banned.ok).toBe(true);
    const { watchPartyMembers } = repositories;
    expect(expectOk(await watchPartyMembers.isBanned(ROOM_ID, GUEST_KEY, null))).toBe(true);
    expect(
      expectOk(await watchPartyMembers.isBanned(ROOM_ID, 'guest:another-credential', GUEST_IP_HASH))
    ).toBe(true);
    expect((await seatOf(party, GUEST_KEY))?.leftAt).not.toBeNull();
    expect(frames()).toEqual([
      expect.objectContaining({ memberKey: GUEST_KEY, frame: { type: 'kicked' } }),
    ]);
    expect(await linesOf(party)).toEqual([
      { event: 'banned', actorKey: keyOf(OTHER), targetKey: GUEST_KEY, detail: null },
    ]);
  });

  it('bans a member who has already left, and lifts the ban again', async () => {
    const party = await setUpParty([['moderator', OTHER]]);
    const { service, repositories } = party;
    expectOk(await repositories.watchPartyMembers.leave(ROOM_ID, keyOf(MEMBER), null, party.at));

    expect((await service.ban(ROOM_ID, userCaller(OTHER), keyOf(MEMBER), undefined)).ok).toBe(true);
    expect(
      expectOk(await repositories.watchPartyMembers.isBanned(ROOM_ID, keyOf(MEMBER), null))
    ).toBe(true);

    expect((await service.unban(ROOM_ID, userCaller(OTHER), keyOf(MEMBER))).ok).toBe(true);
    expect(
      expectOk(await repositories.watchPartyMembers.isBanned(ROOM_ID, keyOf(MEMBER), null))
    ).toBe(false);
  });

  it.each([
    {
      scenario: 'a member banning',
      action: 'ban',
      actor: MEMBER,
      target: keyOf(OTHER),
      code: MISSING,
    },
    {
      scenario: 'a Moderator banning the owner',
      action: 'ban',
      actor: OTHER,
      target: keyOf(OWNER),
      code: ESCALATION,
    },
    {
      scenario: 'a Moderator banning a Co-host',
      action: 'ban',
      actor: OTHER,
      target: keyOf(KEEPER),
      code: ESCALATION,
    },
    {
      scenario: 'a Moderator banning no seat',
      action: 'ban',
      actor: OTHER,
      target: ABSENT_KEY,
      code: NOT_FOUND,
    },
    {
      scenario: 'a member lifting a ban',
      action: 'unban',
      actor: MEMBER,
      target: keyOf(OTHER),
      code: MISSING,
    },
    {
      scenario: 'a Moderator lifting a ban on no key',
      action: 'unban',
      actor: OTHER,
      target: 'nobody',
      code: NOT_FOUND,
    },
  ] as const)('refuses $scenario', async ({ action, actor, target, code }) => {
    const party = await setUpParty([
      ['moderator', OTHER],
      ['cohost', KEEPER],
    ]);

    const result =
      action === 'ban'
        ? await party.service.ban(ROOM_ID, userCaller(actor), target, undefined)
        : await party.service.unban(ROOM_ID, userCaller(actor), target);

    expect(expectErr(result).code).toBe(code);
    expect(party.frames()).toEqual([]);
  });
});

describe('transferOwner', () => {
  const asOwner = userCaller(OWNER);

  it('hands the room over, leaves the previous owner Co-host and tells the room', async () => {
    const party = await setUpParty();
    const { service, ids, frames, repositories } = party;
    const before = await roomOf(party);

    const moved = await service.transferOwner(ROOM_ID, asOwner, { memberKey: keyOf(MEMBER) });

    const after = await roomOf(party);
    expect(moved).toEqual({
      ok: true,
      value: { ownerKey: keyOf(MEMBER), rolesVersion: before.rolesVersion + 1 },
    });
    expect(after.ownerKey).toBe(keyOf(MEMBER));
    const held = expectOk(await repositories.watchPartyRoles.assignmentsOf(ROOM_ID, keyOf(OWNER)));
    expect(held.map(({ roleId }) => roleId)).toEqual([ids.cohost]);
    expect(frames().map(({ frame }) => frame)).toEqual([
      { type: 'owner', memberKey: keyOf(MEMBER), rolesVersion: after.rolesVersion },
      {
        type: 'member.roles',
        memberKey: keyOf(OWNER),
        roleIds: [ids.cohost],
        expiries: { [ids.cohost]: null },
        rolesVersion: after.rolesVersion,
      },
    ]);
    expect(await linesOf(party)).toEqual([
      { event: 'owner_changed', actorKey: keyOf(OWNER), targetKey: keyOf(MEMBER), detail: null },
    ]);
  });

  it.each([
    {
      scenario: 'a Co-host handing it over',
      actor: OTHER,
      target: keyOf(MEMBER),
      code: ESCALATION,
    },
    {
      scenario: 'the owner handing it to a guest',
      actor: OWNER,
      target: GUEST_KEY,
      code: ESCALATION,
    },
    {
      scenario: 'the owner handing it to themselves',
      actor: OWNER,
      target: keyOf(OWNER),
      code: ESCALATION,
    },
    {
      scenario: 'the owner handing it to no seat',
      actor: OWNER,
      target: ABSENT_KEY,
      code: NOT_FOUND,
    },
  ])('refuses $scenario', async ({ actor, target, code }) => {
    const party = await setUpParty([['cohost', OTHER]]);

    const failure = expectErr(
      await party.service.transferOwner(ROOM_ID, userCaller(actor), { memberKey: target })
    );

    expect(failure.code).toBe(code);
    expect((await roomOf(party)).ownerKey).toBe(keyOf(OWNER));
  });

  it.each([
    { races: 1, outcome: 'succeeds from a fresh context', code: null, calls: 2 },
    { races: 2, outcome: 'is a version conflict', code: ErrorCodes.VERSION_CONFLICT, calls: 2 },
  ])('after a roles change lands first it $outcome', async ({ races, code, calls }) => {
    const party = await setUpParty();
    const { repositories, ids, service, at } = party;
    const { watchPartyRooms, watchPartyRoles } = repositories;
    const transfer = watchPartyRooms.transferOwner.bind(watchPartyRooms);
    let raced = 0;
    const concurrent = vi
      .spyOn(watchPartyRooms, 'transferOwner')
      .mockImplementation(async (id, change) => {
        if (raced < races) {
          raced += 1;
          const line = { ...change.line, id: party.deps.secrets.newId() };
          const dj = {
            roomId: ROOM_ID,
            memberKey: keyOf(OTHER),
            roleId: ids.dj,
            grantedBy: keyOf(OWNER),
            expiresAt: null,
            createdAt: at,
          };
          expectOk(await watchPartyRoles.assign(dj, { line, at }));
        }
        return transfer(id, change);
      });

    const moved = await service.transferOwner(ROOM_ID, asOwner, { memberKey: keyOf(MEMBER) });

    expect(moved.ok ? null : moved.error.code).toBe(code);
    expect(concurrent).toHaveBeenCalledTimes(calls);
  });
});
