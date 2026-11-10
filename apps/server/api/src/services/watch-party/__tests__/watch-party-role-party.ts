import { type WatchPartyPreset } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { type CreateRoleInput, WatchPartyRoleService } from '../watch-party-role-service';
import {
  ROOM_ID,
  roleIdsOf,
  seatGuest,
  seatUser,
  seedRoom,
} from './watch-party-moderation-fixture';
import { MEMBER, OTHER, OWNER, userCaller, watchPartyTestDeps } from './watch-party-test-deps';

export const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000f0aa', role: 'USER' };
export const PUBLIC_MEMBER = [
  'playback.request',
  'queue.vote',
  'chat.post',
  'chat.react',
  'voice.join',
];
export const FRIENDS_MEMBER = [
  'playback.control',
  'playback.request',
  'queue.add',
  'queue.reorder',
  'queue.remove',
  'queue.skip',
  'queue.vote',
  'chat.post',
  'chat.react',
  'voice.join',
  'voice.speak',
  'members.invite',
];

export async function setUpRoles(preset: WatchPartyPreset = 'friends') {
  const test = watchPartyTestDeps();
  const { repositories, deps } = test;
  const at = deps.now();
  await seedRoom(repositories, OWNER, at, preset);
  for (const user of [MEMBER, OTHER]) await seatUser(repositories, user, at);
  await seatGuest(repositories, at);
  const ids = await roleIdsOf(repositories, at);
  const service = new WatchPartyRoleService(deps);
  const roles = async () => expectOk(await service.list(ROOM_ID, userCaller(OWNER)));
  const room = async () => expectOk(await repositories.watchPartyRooms.findById(ROOM_ID));
  const lines = async () =>
    expectOk(await repositories.watchPartyMessages.listAfter(ROOM_ID, null, 100)).map(
      ({ system }) => system
    );
  return { ...test, ids, service, roles, room, lines, owner: userCaller(OWNER) };
}

export type Roles = Awaited<ReturnType<typeof setUpRoles>>;

export const sortedKeys = (permissions: readonly string[]) => [...permissions].sort();

export async function permissionsOf(setup: Roles, key: string) {
  const { items } = await setup.roles();
  return items.find((role) => role.key === key)?.permissions ?? [];
}

export const popcorn: CreateRoleInput = {
  name: 'Popcorn crew',
  kind: 'grant',
  permissions: ['chat.pin'],
};
