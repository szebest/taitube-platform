import { cacheUnavailable, ErrorCodes, watchPartyNotFound } from '@vp/errors';
import { err, ok } from '@vp/result';
import { WatchPartyBroadcaster } from '../watch-party-broadcaster';
import {
  afterCommit,
  announce,
  announceMemberRoles,
  appliedOrRefused,
  logChange,
  publishRoles,
  systemLineFor,
} from '../watch-party-moderation-effects';
import { keyOf, ROOM_ID, seatUser, seedRoom, roleIdsOf } from './watch-party-moderation-fixture';
import { OWNER, START, watchPartyTestDeps } from './watch-party-test-deps';

const MEMBER_KEY = 'user:00000000-0000-7000-8000-00000000f002';

describe('systemLineFor', () => {
  it.each([
    {
      scenario: 'a lobby',
      room: {
        currentVideoId: null,
        playback: { itemId: null, phase: 'lobby', positionMs: 0, rate: 1, anchorAt: 0 },
      },
      videoId: null,
      positionMs: 0,
    },
    {
      scenario: 'a room that has been playing for 2.5 seconds at double speed',
      room: {
        currentVideoId: 'video-1',
        playback: {
          itemId: 'item',
          phase: 'playing',
          positionMs: 1000,
          rate: 2,
          anchorAt: START - 2500,
        },
      },
      videoId: 'video-1',
      positionMs: 6000,
    },
  ] as const)('places the line where $scenario stands', ({ room, videoId, positionMs }) => {
    const { deps } = watchPartyTestDeps();

    const line = systemLineFor(deps, room, {
      event: 'roles_changed',
      actorKey: 'user:a',
      targetKey: null,
      detail: 'created:x',
    });

    expect(line).toMatchObject({
      videoId,
      positionMs,
      createdAt: new Date(START),
      line: { event: 'roles_changed', actorKey: 'user:a', targetKey: null, detail: 'created:x' },
    });
  });
});

describe('announce', () => {
  it.each([
    { scenario: 'every socket in the room', toMemberKey: null },
    { scenario: 'one member', toMemberKey: MEMBER_KEY },
  ])('sends a frame to $scenario on the room channel', async ({ toMemberKey }) => {
    const { deps, frames } = watchPartyTestDeps();

    await announce(deps, ROOM_ID, { type: 'kicked' }, toMemberKey);

    expect(frames()).toEqual([
      {
        channel: expect.stringContaining(ROOM_ID),
        memberKey: toMemberKey,
        audience: null,
        except: null,
        frame: { type: 'kicked' },
      },
    ]);
  });

  it('logs a frame that could not be published instead of failing', async () => {
    const { deps, log } = watchPartyTestDeps();
    const failing = new WatchPartyBroadcaster({
      publish: async () => err(cacheUnavailable('publish')),
    });

    await announce({ ...deps, broadcaster: failing }, ROOM_ID, { type: 'kicked' });

    expect(log.lines()).toEqual([
      expect.objectContaining({ level: 'warn', roomId: ROOM_ID, frame: 'kicked' }),
    ]);
  });
});

describe('logChange', () => {
  it.each([
    { target: { targetKey: MEMBER_KEY }, expected: MEMBER_KEY },
    { target: {}, expected: null },
  ])(
    'writes one info line naming room, actor, action and target $expected',
    ({ target, expected }) => {
      const { deps, log } = watchPartyTestDeps();

      logChange(deps, { roomId: ROOM_ID, actorKey: 'user:a', action: 'member.kick', ...target });

      expect(log.lines()).toEqual([
        expect.objectContaining({
          level: 'info',
          roomId: ROOM_ID,
          actorKey: 'user:a',
          action: 'member.kick',
          targetKey: expected,
        }),
      ]);
    }
  );
});

describe('appliedOrRefused', () => {
  it.each([
    {
      write: { type: 'applied', value: 'role', rolesVersion: 3 } as const,
      expected: ok({ value: 'role', rolesVersion: 3 }),
    },
    {
      write: { type: 'conflict' } as const,
      expected: err(expect.objectContaining({ code: ErrorCodes.VERSION_CONFLICT, id: 'role-1' })),
    },
    { write: { type: 'missing' } as const, expected: err(watchPartyNotFound('room-1')) },
  ])('answers $write.type as the matching result', ({ write, expected }) => {
    expect(appliedOrRefused(write, 'room-1', 'role-1')).toEqual(expected);
  });
});

describe('afterCommit', () => {
  it.each([
    { scenario: 'a landed commit', committed: ok(2), ran: true },
    { scenario: 'a refused commit', committed: err(watchPartyNotFound('room-1')), ran: false },
  ])('runs its effects only after $scenario', async ({ committed, ran }) => {
    const effects = vi.fn(async () => {});

    const result = await afterCommit(committed, effects);

    expect(result.ok).toBe(committed.ok);
    expect(effects).toHaveBeenCalledTimes(ran ? 1 : 0);
  });
});

describe('what a role change tells the room', () => {
  async function roomWithMember() {
    const test = watchPartyTestDeps();
    const at = test.deps.now();
    await seedRoom(test.repositories, OWNER, at);
    await seatUser(test.repositories, { id: MEMBER_KEY.slice(5), role: 'USER' }, at);
    return test;
  }

  it('publishRoles sends the list with the version and hands the list back', async () => {
    const { deps, frames } = await roomWithMember();

    const listed = await publishRoles(deps, ROOM_ID, 5);

    expect(listed.ok && listed.value).toHaveLength(11);
    expect(frames()).toEqual([
      expect.objectContaining({
        memberKey: null,
        frame: expect.objectContaining({ type: 'roles', rolesVersion: 5 }),
      }),
    ]);
  });

  it('announceMemberRoles sends the member`s unexpired rows', async () => {
    const { deps, repositories, frames } = await roomWithMember();
    const { dj, vip } = await roleIdsOf(repositories, deps.now());
    const hour = new Date(START + 3_600_000);
    const change = {
      line: systemLineFor(
        deps,
        {
          currentVideoId: null,
          playback: { itemId: null, phase: 'lobby', positionMs: 0, rate: 1, anchorAt: 0 },
        },
        { event: 'role_assigned', actorKey: keyOf(OWNER), targetKey: MEMBER_KEY, detail: null }
      ),
      at: deps.now(),
    };
    const base = {
      roomId: ROOM_ID,
      memberKey: MEMBER_KEY,
      grantedBy: keyOf(OWNER),
      createdAt: deps.now(),
    };
    await repositories.watchPartyRoles.assign({ ...base, roleId: dj, expiresAt: hour }, change);
    await repositories.watchPartyRoles.assign(
      { ...base, roleId: vip, expiresAt: new Date(START - 1) },
      change
    );

    await announceMemberRoles(deps, ROOM_ID, MEMBER_KEY, 9);

    expect(frames()).toEqual([
      expect.objectContaining({
        frame: {
          type: 'member.roles',
          memberKey: MEMBER_KEY,
          roleIds: [dj],
          expiries: { [dj]: hour.toISOString() },
          rolesVersion: 9,
        },
      }),
    ]);
  });
});
