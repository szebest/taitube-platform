import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { GUEST_KEY, keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { popcorn, setUpRoles, STRANGER } from './watch-party-role-party';
import { ANONYMOUS, guestCaller, MEMBER, OWNER, userCaller } from './watch-party-test-deps';

describe('list', () => {
  it('answers every role, highest position first, with both versions', async () => {
    const { roles, room } = await setUpRoles();

    const listed = await roles();

    expect(listed.items.map(({ position }) => position)).toEqual(
      [...listed.items.map(({ position }) => position)].sort((a, b) => b - a)
    );
    expect(listed.items).toHaveLength(11);
    expect(listed.rolesVersion).toBe((await room())?.rolesVersion);
  });

  it.each([
    { scenario: 'a seated account', caller: userCaller(MEMBER), code: null },
    {
      scenario: 'a seated guest',
      caller: guestCaller({
        principal: { kind: 'guest', guestId: GUEST_KEY.slice(6), name: 'Guest 4821' },
        ipHash: null,
      }),
      code: null,
    },
    {
      scenario: 'an account that never joined',
      caller: userCaller(STRANGER),
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    { scenario: 'nobody', caller: ANONYMOUS, code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
  ])('lets $scenario read it: $code', async ({ caller, code }) => {
    const { service } = await setUpRoles();

    const listed = await service.list(ROOM_ID, caller);

    expect(listed.ok ? null : listed.error.code).toBe(code);
  });
});

describe('create', () => {
  it('stores the role below the creator, writes the line, tells the room once and logs it', async () => {
    const setup = await setUpRoles();
    const { service, owner, frames, lines, log, room } = setup;

    const created = expectOk(await service.create(ROOM_ID, owner, popcorn));

    expect(created).toMatchObject({
      key: null,
      name: 'Popcorn crew',
      position: 999,
      memberCount: 0,
    });
    expect(await lines()).toEqual([
      {
        event: 'roles_changed',
        actorKey: keyOf(OWNER),
        targetKey: null,
        detail: 'created:Popcorn crew',
      },
    ]);
    const rolesVersion = (await room())?.rolesVersion;
    expect(frames()).toEqual([
      expect.objectContaining({
        memberKey: null,
        frame: expect.objectContaining({ type: 'roles', rolesVersion }),
      }),
    ]);
    expect(log.lines()).toEqual([
      expect.objectContaining({
        level: 'info',
        roomId: ROOM_ID,
        actorKey: keyOf(OWNER),
        action: 'role.create',
        targetKey: created.id,
      }),
    ]);
  });

  it.each([
    { scenario: 'a blank name', input: { ...popcorn, name: '   ' }, field: 'name' },
    {
      scenario: 'a position a built-in role holds',
      input: { ...popcorn, position: 600 },
      field: 'position',
    },
  ])('refuses $scenario as VALIDATION_FAILED on $field', async ({ input, field }) => {
    const { service, owner, frames } = await setUpRoles();

    const failure = expectErr(await service.create(ROOM_ID, owner, input));

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field });
    expect(frames()).toEqual([]);
  });
});

describe('update', () => {
  it('renames the role, guarded by the updatedAt the editor read', async () => {
    const { service, owner, ids, roles, frames } = await setUpRoles();
    const { updatedAt } = (await roles()).items.find((role) => role.id === ids.dj) ?? {
      updatedAt: '',
    };

    const updated = expectOk(
      await service.update(ROOM_ID, owner, ids.dj, { name: 'Selector', updatedAt })
    );

    expect(updated).toMatchObject({ id: ids.dj, name: 'Selector', key: 'dj' });
    expect(frames()).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'a stale updatedAt',
      pick: 'dj',
      patch: { name: 'Late', updatedAt: '2020-01-01T00:00:00.000Z' },
      code: ErrorCodes.VERSION_CONFLICT,
    },
    {
      scenario: 'a role the room does not have',
      pick: 'absent',
      patch: { name: 'x', updatedAt: '2020-01-01T00:00:00.000Z' },
      code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND,
    },
    {
      scenario: 'a blank name',
      pick: 'dj',
      patch: { name: ' ' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', async ({ pick, patch, code }) => {
    const { service, owner, ids, roles, frames } = await setUpRoles();
    const roleId = pick === 'absent' ? '018f0000-0000-7000-8000-0000000000ff' : ids.dj;
    const current = (await roles()).items.find((role) => role.id === roleId)?.updatedAt;

    const failure = expectErr(
      await service.update(ROOM_ID, owner, roleId, {
        updatedAt: current ?? '2020-01-01T00:00:00.000Z',
        ...patch,
      })
    );

    expect(failure.code).toBe(code);
    expect(frames()).toEqual([]);
  });
});

describe('remove', () => {
  it('deletes a custom role, takes it from its holders and tells the room', async () => {
    const { service, owner, repositories, frames } = await setUpRoles();
    const { id } = expectOk(await service.create(ROOM_ID, owner, popcorn));
    expectOk(await service.assign(ROOM_ID, owner, keyOf(MEMBER), id, undefined));
    const before = frames().length;

    const removed = await service.remove(ROOM_ID, owner, id);

    expect(removed.ok).toBe(true);
    expect(
      expectOk(await repositories.watchPartyRoles.assignmentsOf(ROOM_ID, keyOf(MEMBER)))
    ).toEqual([]);
    expect(frames().slice(before)).toEqual([
      expect.objectContaining({ frame: expect.objectContaining({ type: 'roles' }) }),
    ]);
  });

  it.each([
    { scenario: 'a built-in role', pick: 'dj', code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED },
    {
      scenario: 'a role the room does not have',
      pick: 'absent',
      code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND,
    },
  ])('refuses $scenario with $code', async ({ pick, code }) => {
    const { service, owner, ids } = await setUpRoles();

    const failure = expectErr(
      await service.remove(
        ROOM_ID,
        owner,
        pick === 'absent' ? '018f0000-0000-7000-8000-0000000000ff' : ids.dj
      )
    );

    expect(failure.code).toBe(code);
  });
});
