import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { joinRoom } from '../watch-party-join';
import { closeRoom, updateRoom } from '../watch-party-settings';
import { assignRole, assignRoleId, createRole, OWNER_KEY } from './watch-party-access-fixture';
import {
  type PartyBodyOverrides,
  ANONYMOUS,
  MEMBER,
  MODERATOR,
  OTHER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpSettings(body: PartyBodyOverrides = {}) {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test, body);
  const update = (
    patch: Record<string, unknown>,
    caller = userCaller(OWNER),
    version = room.version
  ) => updateRoom(test.deps, room.id, caller, { version, ...patch });
  const close = (caller = userCaller(OWNER)) => closeRoom(test.deps, room.id, caller);
  const stored = async () => expectOk(await test.repositories.watchPartyRooms.findById(room.id));
  const seat = async (user = MEMBER) =>
    expectOk(await joinRoom(test.deps, room.id, userCaller(user), undefined));
  return { ...test, room, update, close, stored, seat };
}

describe('apps/server/api/services: updateRoom', () => {
  it('applies what was sent against the version read, and answers the room as it is now', async () => {
    const { update } = await setUpSettings();

    const view = expectOk(
      await update({
        name: ' Late   show ',
        visibility: 'public',
        capacity: 8,
        slowModeSeconds: 30,
        chatEnabled: false,
        accent: '#aa3377',
      })
    );

    expect(view).toMatchObject({
      name: 'Late show',
      visibility: 'public',
      capacity: 8,
      effectiveCapacity: 8,
      slowModeSeconds: 30,
      chatEnabled: false,
      accent: '#aa3377',
      version: 2,
    });
  });

  it('writes a settings line and tells every socket the new room', async () => {
    const { update, repositories, frames, systemLines, room, log } = await setUpSettings();

    const view = expectOk(await update({ name: 'Renamed' }));

    const lines = expectOk(await repositories.watchPartyMessages.listAfter(room.id, null, 10));
    expect(lines.map(({ system }) => system?.event)).toEqual(['settings_changed']);
    expect(frames()).toEqual([
      expect.objectContaining({ memberKey: null, frame: { type: 'settings', room: view } }),
    ]);
    expect(systemLines().map((line) => line?.event)).toEqual(['settings_changed']);
    expect(log.lines()).toContainEqual(
      expect.objectContaining({ roomId: room.id, actorKey: OWNER_KEY, action: 'settings' })
    );
  });

  it('leaves what was not sent alone', async () => {
    const { update, room } = await setUpSettings({ name: 'Keep me', capacity: 12 });

    expect(expectOk(await update({ autoplay: false }))).toMatchObject({
      name: 'Keep me',
      capacity: 12,
      autoplay: false,
      visibility: room.visibility,
    });
  });

  it('sets, changes and clears the password, keeping only a hash', async () => {
    const { update, stored } = await setUpSettings();

    expectOk(await update({ password: 'first one' }));
    const first = (await stored())?.passwordHash;
    expectOk(await update({ password: 'second one' }, userCaller(OWNER), 2));
    const second = (await stored())?.passwordHash;
    const cleared = expectOk(await update({ password: null }, userCaller(OWNER), 3));

    expect(first).toMatch(/^scrypt\$/);
    expect(second).toMatch(/^scrypt\$/);
    expect(second).not.toBe(first);
    expect(cleared.hasPassword).toBe(false);
    expect((await stored())?.passwordHash).toBeNull();
  });

  it('keeps every member when the capacity drops below the room’s size', async () => {
    const { update, seat, repositories, room } = await setUpSettings({ capacity: 12 });
    await seat(MEMBER);
    await seat(OTHER);

    expectOk(await update({ capacity: 2 }));

    expect(expectOk(await repositories.watchPartyMembers.listSeated(room.id))).toHaveLength(3);
  });

  it('refuses a version that is no longer current', async () => {
    const { update } = await setUpSettings();
    expectOk(await update({ name: 'First' }));

    expect(expectErr(await update({ name: 'Second' }))).toMatchObject({
      code: ErrorCodes.VERSION_CONFLICT,
      expectedVersion: 1,
    });
  });

  it.each([
    { scenario: 'a signed-out caller', as: ANONYMOUS, code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a plain member',
      as: userCaller(MEMBER),
      seated: true,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a stranger',
      as: userCaller(OTHER),
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'platform staff, who moderate but do not edit',
      as: userCaller(MODERATOR),
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a capacity over the ceiling',
      patch: { capacity: 201 },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a name that is a link',
      patch: { name: 'www.example.com' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a password under four characters',
      patch: { password: 'abc' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a schedule in the past',
      patch: { scheduledFor: '2026-02-01T00:00:00.000Z' },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])(
    'refuses $scenario with $code',
    async ({ as = userCaller(OWNER), seated, patch = { name: 'X' }, code }) => {
      const world = await setUpSettings();
      if (seated) await world.seat(MEMBER);

      expect(expectErr(await world.update(patch, as)).code).toBe(code);
    }
  );

  it('names the permission a member is missing', async () => {
    const world = await setUpSettings();
    await world.seat(MEMBER);

    expect(expectErr(await world.update({ name: 'X' }, userCaller(MEMBER)))).toMatchObject({
      permission: 'room.edit',
    });
  });

  it('lets a Co-host edit and schedule', async () => {
    const world = await setUpSettings();
    await world.seat(MEMBER);
    await assignRole(world, world.room.id, `user:${MEMBER.id}`, 'cohost');
    const startsAt = new Date(world.clock.nowMs + 3_600_000).toISOString();

    expect(
      expectOk(
        await world.update({ name: 'Co-hosted', scheduledFor: startsAt }, userCaller(MEMBER))
      )
    ).toMatchObject({ name: 'Co-hosted', scheduledFor: startsAt });
  });

  it('asks for the schedule permission on top of the edit one when a schedule is sent', async () => {
    const world = await setUpSettings();
    await world.seat(MEMBER);
    const editor = await createRole(world, world.room.id, {
      name: 'Editor',
      position: 250,
      permissions: ['room.edit'],
    });
    await assignRoleId(world, world.room.id, `user:${MEMBER.id}`, editor);

    expectOk(await world.update({ name: 'Editable' }, userCaller(MEMBER)));
    expect(expectErr(await world.update({ autoStart: true }, userCaller(MEMBER), 2))).toMatchObject(
      {
        permission: 'room.schedule',
      }
    );
  });

  it('refuses a room that is closed', async () => {
    const world = await setUpSettings();
    expectOk(await world.close());

    expect(expectErr(await world.update({ name: 'Too late' })).code).toBe(
      ErrorCodes.WATCH_PARTY_CLOSED
    );
  });
});

describe('apps/server/api/services: closeRoom', () => {
  it.each([
    { scenario: 'the owner', as: userCaller(OWNER), reason: 'owner' },
    { scenario: 'platform staff', as: userCaller(MODERATOR), reason: 'moderator' },
  ])('lets $scenario end the room, recording $reason', async ({ as, reason }) => {
    const { close, stored, frames, log, room } = await setUpSettings();

    const view = expectOk(await close(as));

    expect(view).toMatchObject({ status: 'closed', closedReason: reason });
    expect((await stored())?.status).toBe('closed');
    expect(frames()).toEqual([
      expect.objectContaining({ memberKey: null, frame: { type: 'closed', reason } }),
    ]);
    expect(log.lines()).toContainEqual(
      expect.objectContaining({ roomId: room.id, action: 'close' })
    );
  });

  it.each([
    { scenario: 'a signed-out caller', as: ANONYMOUS, code: ErrorCodes.UNAUTHORIZED },
    {
      scenario: 'a stranger',
      as: userCaller(OTHER),
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a plain member',
      as: userCaller(MEMBER),
      seated: true,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
    {
      scenario: 'a Co-host, who may edit but not close',
      as: userCaller(MEMBER),
      seated: true,
      role: 'cohost' as const,
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    },
  ])('refuses $scenario with $code', async ({ as, seated, role, code }) => {
    const world = await setUpSettings();
    if (seated) await world.seat(MEMBER);
    if (role) await assignRole(world, world.room.id, `user:${MEMBER.id}`, role);

    expect(expectErr(await world.close(as))).toMatchObject({ code });
    expect((await world.stored())?.status).toBe('open');
  });

  it('refuses a second close', async () => {
    const world = await setUpSettings();
    expectOk(await world.close());

    expect(expectErr(await world.close()).code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
  });
});
