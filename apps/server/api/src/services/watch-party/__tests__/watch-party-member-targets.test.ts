import { ErrorCodes } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  actingInRoom,
  actorKeyOf,
  memberKeyIn,
  resolveTarget,
  roleOf,
} from '../watch-party-member-targets';
import {
  GUEST_KEY,
  keyOf,
  ROOM_ID,
  roleIdsOf,
  seatGuest,
  seatUser,
  seedRoom,
} from './watch-party-moderation-fixture';
import {
  ANONYMOUS,
  MEMBER,
  OTHER,
  OWNER,
  START,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

const LEFT_KEY = 'user:00000000-0000-7000-8000-00000000f0ee';
const ABSENT_KEY = 'user:00000000-0000-7000-8000-00000000f0ff';
const MINUTE_MS = 60_000;

async function setUpTargets() {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at);
  for (const user of [MEMBER, OTHER]) await seatUser(repositories, user, at);
  await seatUser(repositories, { id: LEFT_KEY.slice(5), role: 'USER' }, at);
  expectOk(await repositories.watchPartyMembers.leave(ROOM_ID, LEFT_KEY, null, at));
  await seatGuest(repositories, at);
  const ids = await roleIdsOf(repositories, at);
  const grant = async (user: typeof OTHER, roleId: string, expiresAt: Date | null) => {
    const line = {
      id: deps.secrets.newId(),
      line: { event: 'role_assigned' as const, actorKey: null, targetKey: null, detail: null },
      videoId: null,
      positionMs: null,
      createdAt: at,
    };
    const row = {
      roomId: ROOM_ID,
      memberKey: keyOf(user),
      roleId,
      grantedBy: keyOf(OWNER),
      expiresAt,
      createdAt: at,
    };
    expectOk(await repositories.watchPartyRoles.assign(row, { line, at }));
  };
  const contextOf = async (caller = userCaller(OWNER)) =>
    expectOk(await deps.context.load(ROOM_ID, caller));
  return { ...test, ids, grant, contextOf };
}

interface Standing {
  scenario: string;
  key: string;
  isOwner: boolean;
  kind: string;
  topPosition: number;
  held?: { role: 'dj' | 'moderator'; expiresAfterMs: number | null };
}

describe('resolveTarget', () => {
  it.each<Standing>([
    { scenario: 'the owner', key: keyOf(OWNER), isOwner: true, kind: 'user', topPosition: 1000 },
    {
      scenario: 'a member with no role',
      key: keyOf(MEMBER),
      isOwner: false,
      kind: 'user',
      topPosition: 1,
    },
    { scenario: 'a guest', key: GUEST_KEY, isOwner: false, kind: 'guest', topPosition: 0 },
    {
      scenario: 'a DJ',
      key: keyOf(OTHER),
      isOwner: false,
      kind: 'user',
      topPosition: 400,
      held: { role: 'dj', expiresAfterMs: null },
    },
    {
      scenario: 'someone whose Moderator has expired',
      key: keyOf(OTHER),
      isOwner: false,
      kind: 'user',
      topPosition: 1,
      held: { role: 'moderator', expiresAfterMs: -MINUTE_MS },
    },
  ])(
    'stands $scenario at position $topPosition',
    async ({ key, isOwner, kind, topPosition, held }) => {
      const setup = await setUpTargets();
      if (held) {
        const expiresAt =
          held.expiresAfterMs === null ? null : new Date(START + held.expiresAfterMs);
        await setup.grant(OTHER, setup.ids[held.role], expiresAt);
      }

      const target = expectOk(
        await resolveTarget(setup.deps, await setup.contextOf(), key, 'held')
      );

      expect(target.subject).toEqual({ memberKey: key, kind, isOwner, topPosition });
    }
  );

  it.each<{ scenario: string; key: string; wanted: 'held' | 'any'; code: string | null }>([
    {
      scenario: 'a seat that was left, when it must be held',
      key: LEFT_KEY,
      wanted: 'held',
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'a seat that was left, when any seat will do',
      key: LEFT_KEY,
      wanted: 'any',
      code: null,
    },
    {
      scenario: 'a key that holds no seat',
      key: ABSENT_KEY,
      wanted: 'any',
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'something that is no key',
      key: 'nobody',
      wanted: 'any',
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
  ])('finds $scenario: $code', async ({ key, wanted, code }) => {
    const setup = await setUpTargets();

    const target = await resolveTarget(setup.deps, await setup.contextOf(), key, wanted);

    expect(target.ok ? null : target.error.code).toBe(code);
  });
});

describe('the small lookups', () => {
  it('actorKeyOf names the caller, and fails for one with no key', async () => {
    const setup = await setUpTargets();

    expect(expectOk(actorKeyOf(await setup.contextOf(userCaller(MEMBER))))).toBe(keyOf(MEMBER));
    expect(expectErr(actorKeyOf(await setup.contextOf(ANONYMOUS))).code).toBe(
      ErrorCodes.WATCH_PARTY_NOT_FOUND
    );
  });

  it.each([
    { scenario: 'a role of the room', pick: 'dj', code: null },
    { scenario: 'a role of no room', pick: 'absent', code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND },
  ])('roleOf finds $scenario: $code', async ({ pick, code }) => {
    const setup = await setUpTargets();
    const roleId = pick === 'dj' ? setup.ids.dj : '018f0000-0000-7000-8000-0000000000ff';

    const role = roleOf(await setup.contextOf(), roleId);

    expect(role.ok ? null : role.error.code).toBe(code);
  });

  it.each([
    { key: keyOf(MEMBER), code: null },
    { key: 'guest:short', code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
    { key: 'bot:12345678901234567', code: ErrorCodes.WATCH_PARTY_NOT_FOUND },
  ])('memberKeyIn answers $key: $code', ({ key, code }) => {
    const checked = memberKeyIn(ROOM_ID, key);

    expect(checked.ok ? null : checked.error.code).toBe(code);
  });
});

describe('actingInRoom', () => {
  it('hands the act the context and the caller`s key', async () => {
    const { deps } = await setUpTargets();

    const seen = await actingInRoom(
      deps.context,
      ROOM_ID,
      userCaller(MEMBER),
      async (context, actorKey) => ok({ room: context.room.id, actorKey })
    );

    expect(expectOk(seen)).toEqual({ room: ROOM_ID, actorKey: keyOf(MEMBER) });
  });

  it.each([
    {
      scenario: 'a room that is not there',
      roomId: '018f0000-0000-7000-8000-0000000000ff',
      caller: userCaller(MEMBER),
    },
    { scenario: 'a caller with no key', roomId: ROOM_ID, caller: ANONYMOUS },
  ])(
    'answers WATCH_PARTY_NOT_FOUND for $scenario without running the act',
    async ({ roomId, caller }) => {
      const { deps } = await setUpTargets();
      const act = vi.fn(async (): Promise<Result<number, never>> => ok(1));

      const failure = expectErr(await actingInRoom(deps.context, roomId, caller, act));

      expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
      expect(act).not.toHaveBeenCalled();
    }
  );
});
