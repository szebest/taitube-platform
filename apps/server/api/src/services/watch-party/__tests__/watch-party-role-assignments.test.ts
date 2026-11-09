import type { RoleExpiry } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { WatchPartyRoleService } from '../watch-party-role-service';
import {
  keyOf,
  ROOM_ID,
  roleIdsOf,
  seatGuest,
  seatUser,
  seedRoom,
} from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller, watchPartyTestDeps } from './watch-party-test-deps';

const MINUTE_MS = 60_000;
const ABSENT_ROLE = '018f0000-0000-7000-8000-0000000000ff';
const ABSENT_KEY = 'user:00000000-0000-7000-8000-00000000f0ff';

async function setUpAssignments() {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at);
  for (const user of [MEMBER, OTHER]) await seatUser(repositories, user, at);
  await seatGuest(repositories, at);
  const ids = await roleIdsOf(repositories, at);
  const service = new WatchPartyRoleService(deps);
  const rowsOf = async (memberKey: string) =>
    expectOk(await repositories.watchPartyRoles.assignmentsOf(ROOM_ID, memberKey));
  const effectiveOf = async (user: typeof MEMBER) => {
    const context = expectOk(await deps.context.load(ROOM_ID, userCaller(user)));
    return context.effective.permissions;
  };
  return { ...test, ids, service, rowsOf, effectiveOf, owner: userCaller(OWNER) };
}

describe('assign', () => {
  it('gives the role, writes the line, tells the room the member`s roles and logs it', async () => {
    const { service, owner, ids, rowsOf, frames, log, repositories } = await setUpAssignments();

    const assigned = await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.dj, undefined);

    expect(assigned.ok).toBe(true);
    expect(await rowsOf(keyOf(MEMBER))).toEqual([
      expect.objectContaining({ roleId: ids.dj, grantedBy: keyOf(OWNER), expiresAt: null }),
    ]);
    const { rolesVersion } = expectOk(await repositories.watchPartyRooms.findById(ROOM_ID)) ?? {
      rolesVersion: -1,
    };
    expect(frames().map(({ frame }) => frame)).toEqual([
      {
        type: 'member.roles',
        memberKey: keyOf(MEMBER),
        roleIds: [ids.dj],
        expiries: { [ids.dj]: null },
        rolesVersion,
      },
    ]);
    expect(log.lines()).toEqual([
      expect.objectContaining({
        level: 'info',
        actorKey: keyOf(OWNER),
        action: 'role.assign',
        targetKey: keyOf(MEMBER),
      }),
    ]);
    const lines = expectOk(await repositories.watchPartyMessages.listAfter(ROOM_ID, null, 10));
    expect(lines.map(({ system }) => system)).toEqual([
      { event: 'role_assigned', actorKey: keyOf(OWNER), targetKey: keyOf(MEMBER), detail: 'DJ' },
    ]);
  });

  it.each([
    { expiresIn: '10m', after: 10 * MINUTE_MS },
    { expiresIn: '1h', after: 60 * MINUTE_MS },
    { expiresIn: 'party', after: null },
  ] as { expiresIn: RoleExpiry; after: number | null }[])(
    'dates a Chat muted given for $expiresIn',
    async ({ expiresIn, after }) => {
      const { service, owner, ids, rowsOf, clock } = await setUpAssignments();

      expectOk(await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.chat_muted, { expiresIn }));

      const [row] = await rowsOf(keyOf(MEMBER));
      expect(row?.expiresAt).toEqual(after === null ? null : new Date(clock.nowMs + after));
    }
  );

  it('stops applying a 10-minute mute at 10 minutes with nothing having run', async () => {
    const { service, owner, ids, effectiveOf, rowsOf, clock } = await setUpAssignments();
    expectOk(
      await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.chat_muted, { expiresIn: '10m' })
    );

    clock.advance(10 * MINUTE_MS - 1);
    const muted = await effectiveOf(MEMBER);
    clock.advance(1);
    const lifted = await effectiveOf(MEMBER);

    expect(muted).not.toContain('chat.post');
    expect(lifted).toContain('chat.post');
    expect(await rowsOf(keyOf(MEMBER))).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'an expiry on a role that is no mute',
      roleKey: 'dj',
      target: keyOf(MEMBER),
      expected: { code: ErrorCodes.VALIDATION_FAILED, field: 'expiresIn' },
    },
    {
      scenario: 'a role the room does not have',
      roleKey: 'absent',
      target: keyOf(MEMBER),
      expected: { code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND },
    },
    {
      scenario: 'a key that holds no seat',
      roleKey: 'dj',
      target: ABSENT_KEY,
      expected: { code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
    },
  ])('refuses $scenario', async ({ roleKey, target, expected }) => {
    const { service, owner, ids, rowsOf, frames } = await setUpAssignments();
    const roleId = roleKey === 'absent' ? ABSENT_ROLE : ids.dj;

    const failure = expectErr(
      await service.assign(ROOM_ID, owner, target, roleId, { expiresIn: '1h' })
    );

    expect(failure).toMatchObject(expected);
    expect(await rowsOf(keyOf(MEMBER))).toEqual([]);
    expect(frames()).toEqual([]);
  });
});

describe('revoke', () => {
  it('takes the role back and tells the room what the member still holds', async () => {
    const { service, owner, ids, rowsOf, frames } = await setUpAssignments();
    expectOk(await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.dj, undefined));
    expectOk(await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.vip, undefined));

    const revoked = await service.revoke(ROOM_ID, owner, keyOf(MEMBER), ids.dj);

    expect(revoked.ok).toBe(true);
    expect((await rowsOf(keyOf(MEMBER))).map(({ roleId }) => roleId)).toEqual([ids.vip]);
    expect(frames().at(-1)?.frame).toMatchObject({ type: 'member.roles', roleIds: [ids.vip] });
  });

  it('lets a member drop a grant role they hold themselves', async () => {
    const { service, owner, ids, rowsOf } = await setUpAssignments();
    expectOk(await service.assign(ROOM_ID, owner, keyOf(MEMBER), ids.dj, undefined));

    const dropped = await service.revoke(ROOM_ID, userCaller(MEMBER), keyOf(MEMBER), ids.dj);

    expect(dropped.ok).toBe(true);
    expect(await rowsOf(keyOf(MEMBER))).toEqual([]);
  });

  it('answers ROLE_NOT_FOUND for a role the member does not hold', async () => {
    const { service, owner, ids } = await setUpAssignments();

    const failure = expectErr(await service.revoke(ROOM_ID, owner, keyOf(MEMBER), ids.dj));

    expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND);
  });
});
