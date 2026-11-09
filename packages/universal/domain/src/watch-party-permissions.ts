import type { WatchPartyPreset } from './watch-party-roles';

const WATCH_PARTY_PERMISSION_GROUPS = [
  'playback',
  'queue',
  'chat',
  'voice',
  'members',
  'room',
  'roles',
] as const;
type WatchPartyPermissionGroup = (typeof WATCH_PARTY_PERMISSION_GROUPS)[number];

/** The built-in roles whose defaults a registry entry names; Owner and Spectator take every entry. */
type DefaultingRoleKey =
  | 'cohost'
  | 'moderator'
  | 'chat_muted'
  | 'voice_muted'
  | 'dj'
  | 'speaker'
  | 'vip'
  | 'guest';

export interface WatchPartyPermissionEntry {
  readonly id: string;
  readonly group: WatchPartyPermissionGroup;
  /** The `WATCH_PARTY_PERMISSIONS_VERSION` that added it: `upgradeRoomRoles` adds it to older rooms. */
  readonly since: number;
  /** The built-in roles holding it by default; for a restrict role, the ones removing it. */
  readonly roles: readonly DefaultingRoleKey[];
  /** The presets whose Member holds it. */
  readonly member: readonly WatchPartyPreset[];
}

const BOTH: readonly WatchPartyPreset[] = ['friends', 'public'];
const FRIENDS: readonly WatchPartyPreset[] = ['friends'];

/**
 * The closed, versioned list of what can be done in a room. Extending it is one entry here with
 * `since` set to the next version, and an enforcement case in the API's permission spec.
 */
export const WATCH_PARTY_PERMISSIONS = [
  { id: 'playback.control', group: 'playback', since: 1, roles: ['cohost', 'dj'], member: FRIENDS },
  { id: 'playback.request', group: 'playback', since: 1, roles: ['cohost'], member: BOTH },
  { id: 'queue.add', group: 'queue', since: 1, roles: ['cohost', 'dj'], member: FRIENDS },
  { id: 'queue.reorder', group: 'queue', since: 1, roles: ['cohost', 'dj'], member: FRIENDS },
  { id: 'queue.remove', group: 'queue', since: 1, roles: ['cohost', 'dj'], member: FRIENDS },
  { id: 'queue.skip', group: 'queue', since: 1, roles: ['cohost', 'dj'], member: FRIENDS },
  { id: 'queue.vote', group: 'queue', since: 1, roles: ['cohost'], member: BOTH },
  { id: 'chat.post', group: 'chat', since: 1, roles: ['cohost', 'chat_muted'], member: BOTH },
  { id: 'chat.react', group: 'chat', since: 1, roles: ['cohost', 'chat_muted'], member: BOTH },
  { id: 'chat.pin', group: 'chat', since: 1, roles: ['cohost', 'moderator', 'vip'], member: [] },
  { id: 'chat.moderate', group: 'chat', since: 1, roles: ['cohost', 'moderator'], member: [] },
  {
    id: 'chat.bypassSlowMode',
    group: 'chat',
    since: 1,
    roles: ['cohost', 'moderator', 'vip'],
    member: [],
  },
  { id: 'voice.join', group: 'voice', since: 1, roles: ['cohost', 'guest'], member: BOTH },
  {
    id: 'voice.speak',
    group: 'voice',
    since: 1,
    roles: ['cohost', 'voice_muted', 'speaker'],
    member: FRIENDS,
  },
  { id: 'voice.moderate', group: 'voice', since: 1, roles: ['cohost', 'moderator'], member: [] },
  {
    id: 'members.invite',
    group: 'members',
    since: 1,
    roles: ['cohost', 'moderator'],
    member: FRIENDS,
  },
  { id: 'members.kick', group: 'members', since: 1, roles: ['cohost', 'moderator'], member: [] },
  { id: 'members.ban', group: 'members', since: 1, roles: ['cohost', 'moderator'], member: [] },
  {
    id: 'members.joinWhenFull',
    group: 'members',
    since: 1,
    roles: ['cohost', 'moderator', 'vip'],
    member: [],
  },
  { id: 'room.edit', group: 'room', since: 1, roles: ['cohost'], member: [] },
  { id: 'room.schedule', group: 'room', since: 1, roles: ['cohost'], member: [] },
  { id: 'room.close', group: 'room', since: 1, roles: [], member: [] },
  { id: 'roles.assign', group: 'roles', since: 1, roles: ['cohost', 'moderator'], member: [] },
  { id: 'roles.manage', group: 'roles', since: 1, roles: [], member: [] },
] as const satisfies readonly WatchPartyPermissionEntry[];

export type WatchPartyPermission = (typeof WATCH_PARTY_PERMISSIONS)[number]['id'];

export const WATCH_PARTY_PERMISSION_IDS: readonly WatchPartyPermission[] =
  WATCH_PARTY_PERMISSIONS.map((entry) => entry.id);

export const WATCH_PARTY_PERMISSIONS_VERSION = Math.max(
  ...WATCH_PARTY_PERMISSIONS.map((entry) => entry.since)
);

/** Voice enforces these once it ships, so the server's enforcement spec asks no case of them yet. */
export const PENDING_ENFORCEMENT: readonly WatchPartyPermission[] = [
  'voice.join',
  'voice.speak',
  'voice.moderate',
];

/** A guest's permissions are clamped to these after every role and every row, whatever the database says. */
export const GUEST_CEILING: readonly WatchPartyPermission[] = ['voice.join'];

/** Held by platform MODERATOR and ADMIN accounts in every room, for abuse response. */
export const PLATFORM_STAFF_PERMISSIONS: readonly WatchPartyPermission[] = [
  'chat.moderate',
  'voice.moderate',
  'members.kick',
  'members.ban',
  'room.close',
];

export function isWatchPartyPermission(value: string): value is WatchPartyPermission {
  return (WATCH_PARTY_PERMISSION_IDS as readonly string[]).includes(value);
}
