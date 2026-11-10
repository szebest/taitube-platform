import type { BuiltInRoleKey, WatchPartyRoom } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { WatchPartyMemberService } from '../watch-party-member-service';
import {
  keyOf,
  ROOM_ID,
  roleIdsOf,
  seatGuest,
  seatUser,
  seedRoom,
} from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, watchPartyTestDeps } from './watch-party-test-deps';

export const KEEPER: UserContext = { id: '00000000-0000-7000-8000-00000000f005', role: 'USER' };
export const ABSENT_KEY = 'user:00000000-0000-7000-8000-00000000f0ff';
export const SEATED = 5;

export type Held = readonly (readonly [BuiltInRoleKey, UserContext])[];

export async function setUpParty(held: Held = []) {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at);
  for (const user of [MEMBER, OTHER, KEEPER]) await seatUser(repositories, user, at);
  await seatGuest(repositories, at);
  const ids = await roleIdsOf(repositories, at);
  for (const [key, user] of held) {
    const line = {
      id: deps.secrets.newId(),
      line: { event: 'role_assigned' as const, actorKey: null, targetKey: null, detail: null },
      videoId: null,
      positionMs: null,
      createdAt: at,
    };
    const assignment = {
      roomId: ROOM_ID,
      memberKey: keyOf(user),
      roleId: ids[key],
      grantedBy: keyOf(OWNER),
      expiresAt: null,
      createdAt: at,
    };
    expectOk(await repositories.watchPartyRoles.assign(assignment, { line, at }));
  }
  const seeded = expectOk(await repositories.watchPartyMessages.listAfter(ROOM_ID, null, 100));
  return { ...test, ids, service: new WatchPartyMemberService(deps), at, seeded: seeded.length };
}

export type Party = Awaited<ReturnType<typeof setUpParty>>;

export const roomOf = async ({ repositories }: Party): Promise<WatchPartyRoom> => {
  const room = expectOk(await repositories.watchPartyRooms.findById(ROOM_ID));
  if (room === null) throw new Error('the room is gone');
  return room;
};

export const linesOf = async ({ repositories, seeded }: Party) =>
  expectOk(await repositories.watchPartyMessages.listAfter(ROOM_ID, null, 100))
    .slice(seeded)
    .map(({ system }) => system);

export const seatOf = async ({ repositories }: Party, memberKey: string) =>
  expectOk(await repositories.watchPartyMembers.find(ROOM_ID, memberKey));

export const seatedCount = async ({ repositories }: Party) =>
  expectOk(await repositories.watchPartyMembers.listSeated(ROOM_ID)).length;

export const MISSING = ErrorCodes.WATCH_PARTY_PERMISSION_MISSING;
export const ESCALATION = ErrorCodes.WATCH_PARTY_ROLE_ESCALATION;
export const NOT_FOUND = ErrorCodes.WATCH_PARTY_NOT_FOUND;
