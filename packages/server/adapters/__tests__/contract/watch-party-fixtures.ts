import type {
  NewSystemLine,
  NewWatchPartyRole,
  RolesChange,
  WatchPartyRoomSeed,
} from '@vp/core/repositories';
import {
  BUILT_IN_ROLE_KEYS,
  type BuiltInRoleKey,
  builtInRoles,
  lobbyPlayback,
  QUICK_PARTY_SETTINGS,
  WATCH_PARTY_PERMISSIONS_VERSION,
  type WatchPartyMemberRole,
  type WatchPartyRoleRecord,
  type WatchPartyRoom,
} from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export const AT = new Date('2026-03-01T12:00:00.000Z');
const MINUTE_MS = 60_000;

export const ROOM_ID = '00000000-0000-7000-8000-00000000e001';
export const OTHER_ROOM_ID = '00000000-0000-7000-8000-00000000e002';
export const OWNER_KEY = `user:${OWNER_ID}`;
export const OTHER_KEY = `user:${OTHER_OWNER_ID}`;
export const GUEST_KEY = 'guest:abcdefghijklmnop';

const numbered = (group: number, n: number) =>
  `00000000-0000-7000-8000-${String(group).padStart(4, '0')}${String(n).padStart(8, '0')}`;

export const later = (minutes: number) => new Date(AT.getTime() + minutes * MINUTE_MS);

export const UNKNOWN_ROOM_ID = '00000000-0000-7000-8000-00000000e0ff';

export const lineId = (n: number) => numbered(1, n);
export const roleId = (n: number) => numbered(2, n);
export const itemId = (n: number) => numbered(3, n);

/** One id per built-in role of the main room, in registry order, so a case names a role by key. */
export const roleIdOf = (key: BuiltInRoleKey) => roleId(BUILT_IN_ROLE_KEYS.indexOf(key) + 1);

export const lineAt = (n: number, at: Date = AT): NewSystemLine => ({
  id: lineId(n),
  line: { event: 'settings_changed', actorKey: OWNER_KEY, targetKey: null, detail: null },
  videoId: null,
  positionMs: null,
  createdAt: at,
});

export const rolesChange = (n: number, at: Date = AT): RolesChange => ({ line: lineAt(n, at), at });

export const customRole = (overrides: Partial<NewWatchPartyRole> = {}): NewWatchPartyRole => ({
  id: roleId(50),
  roomId: ROOM_ID,
  key: null,
  kind: 'grant',
  name: 'Popcorn crew',
  colour: null,
  position: 450,
  permissions: ['chat.pin'],
  ...overrides,
});

export const CUSTOM_ROLE_ID = customRole().id;

export const assignment = (
  overrides: Partial<WatchPartyMemberRole> = {}
): WatchPartyMemberRole => ({
  roomId: ROOM_ID,
  memberKey: OTHER_KEY,
  roleId: roleIdOf('dj'),
  grantedBy: OWNER_KEY,
  expiresAt: null,
  createdAt: AT,
  ...overrides,
});

export interface RoomSeedOptions {
  readonly id?: string;
  readonly ownerKey?: string;
  readonly videoIds?: readonly string[];
}

export function roomSeed({
  id = ROOM_ID,
  ownerKey = OWNER_KEY,
  videoIds = [],
}: RoomSeedOptions = {}): WatchPartyRoomSeed {
  const queue = videoIds.map((videoId, index) => ({
    id: itemId(index + 1),
    roomId: id,
    videoId,
    addedBy: ownerKey,
    startMs: 0,
    createdAt: AT,
  }));
  return {
    room: {
      ...QUICK_PARTY_SETTINGS,
      id,
      name: 'Movie night',
      ownerKey,
      asChannelId: null,
      passwordHash: null,
      playback: lobbyPlayback(queue[0]?.id ?? null),
      permissionsVersion: WATCH_PARTY_PERMISSIONS_VERSION,
      createdAt: AT,
    },
    roles: builtInRoles('friends').map((role, index) => ({
      ...role,
      id: id === ROOM_ID ? roleId(index + 1) : uuidv7(),
    })),
    owner: {
      roomId: id,
      memberKey: ownerKey,
      kind: 'user',
      userId: OWNER_ID,
      discordUserId: null,
      displayName: null,
      avatarUrl: null,
      ipHash: null,
      joinedVia: 'owner',
      joinedAt: AT,
    },
    queue,
  };
}

export interface WatchPartyContext {
  readonly subject: RepositoriesSubject;
  createRoom(options?: RoomSeedOptions): Promise<WatchPartyRoom>;
  /** The main room as stored now. */
  room(): Promise<WatchPartyRoom>;
  rolesVersion(): Promise<number>;
  /** The main room's roles as `list` answers them, at the base time. */
  roleList(): Promise<(WatchPartyRoleRecord & { memberCount: number })[]>;
  permissionsOf(key: BuiltInRoleKey): Promise<readonly string[] | undefined>;
  /** The ids of the system lines stored for a room, oldest first. */
  lineIds(roomId?: string): Promise<string[]>;
}

/** Registers the hooks that give every contract case an empty database holding two accounts and two ready videos. */
export function setUpWatchParty(makeSubject: MakeRepositoriesSubject): WatchPartyContext {
  let subject: RepositoriesSubject;

  beforeAll(async () => {
    subject = await makeSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  beforeEach(async () => {
    await subject.reset();
    await seedOwners(subject.repositories);
    for (const id of [VIDEO_IDS.a, VIDEO_IDS.b]) await subject.seedVideo(publicVideo({ id }));
  });

  const roleList = async () =>
    expectOk(await subject.repositories.watchPartyRoles.list(ROOM_ID, AT));
  const room = async () => {
    const found = expectOk(await subject.repositories.watchPartyRooms.findById(ROOM_ID));
    if (!found) throw new Error('the room is not there');
    return found;
  };

  return {
    get subject() {
      return subject;
    },
    room,
    roleList,
    rolesVersion: async () => (await room()).rolesVersion,
    permissionsOf: async (key) => (await roleList()).find((role) => role.key === key)?.permissions,
    createRoom: async (options) =>
      expectOk(await subject.repositories.watchPartyRooms.create(roomSeed(options))),
    lineIds: async (roomId = ROOM_ID) =>
      expectOk(await subject.repositories.watchPartyMessages.listAfter(roomId, null, 100)).map(
        ({ id }) => id
      ),
  };
}
