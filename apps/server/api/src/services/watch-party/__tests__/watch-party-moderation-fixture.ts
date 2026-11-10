import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import {
  BUILT_IN_ROLE_KEYS,
  type BuiltInRoleKey,
  builtInRoles,
  lobbyPlayback,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
  type WatchPartyPreset,
  type WatchPartyRoom,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';

export const ROOM_ID = '018f0000-0000-7000-8000-00000000a001';
export const GUEST_KEY = 'guest:abcdefghijklmnop';
export const GUEST_IP_HASH = 'ip-hash-of-the-guest';

type Seedable = Pick<
  InMemoryRepositories,
  'watchPartyRooms' | 'watchPartyRoles' | 'watchPartyMembers'
>;

export const keyOf = (user: UserContext) => `user:${user.id}`;

export async function seatUser(repositories: Seedable, user: UserContext, at: Date): Promise<void> {
  expectOk(
    await repositories.watchPartyMembers.join(
      {
        roomId: ROOM_ID,
        memberKey: keyOf(user),
        kind: 'user',
        userId: user.id,
        discordUserId: null,
        displayName: null,
        avatarUrl: null,
        ipHash: null,
        joinedVia: 'link',
        joinedAt: at,
      },
      null
    )
  );
}

export async function seatGuest(repositories: Seedable, at: Date, guestKey = GUEST_KEY) {
  expectOk(
    await repositories.watchPartyMembers.join(
      {
        roomId: ROOM_ID,
        memberKey: guestKey,
        kind: 'guest',
        userId: null,
        discordUserId: null,
        displayName: 'Guest 4821',
        avatarUrl: null,
        ipHash: GUEST_IP_HASH,
        joinedVia: 'link',
        joinedAt: at,
      },
      null
    )
  );
}

/** A room holding its eleven built-in roles and its owner's seat, as creating one writes it. */
export async function seedRoom(
  repositories: Seedable,
  owner: UserContext,
  at: Date,
  preset: WatchPartyPreset = 'friends'
): Promise<WatchPartyRoom> {
  const room = expectOk(
    await repositories.watchPartyRooms.create({
      room: {
        ...QUICK_PARTY_SETTINGS,
        id: ROOM_ID,
        name: 'Movie night',
        ownerKey: keyOf(owner),
        asChannelId: null,
        passwordHash: null,
        playback: lobbyPlayback(null),
        permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
        createdAt: at,
      },
      roles: builtInRoles(preset).map((role) => ({ ...role, id: uuidv7() })),
      owner: {
        roomId: ROOM_ID,
        memberKey: keyOf(owner),
        kind: 'user',
        userId: owner.id,
        discordUserId: null,
        displayName: null,
        avatarUrl: null,
        ipHash: null,
        joinedVia: 'owner',
        joinedAt: at,
      },
      queue: [],
    })
  );
  return room;
}

export async function roleIdsOf(
  repositories: Seedable,
  at: Date
): Promise<Record<BuiltInRoleKey, string>> {
  const roles = expectOk(await repositories.watchPartyRoles.list(ROOM_ID, at));
  const ids = (key: BuiltInRoleKey) => roles.find((role) => role.key === key)?.id ?? '';
  return Object.fromEntries(BUILT_IN_ROLE_KEYS.map((key) => [key, ids(key)])) as Record<
    BuiltInRoleKey,
    string
  >;
}
