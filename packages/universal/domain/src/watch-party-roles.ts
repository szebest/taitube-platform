import { MS_PER_HOUR, MS_PER_MINUTE } from './time';
import {
  GUEST_CEILING,
  WATCH_PARTY_PERMISSION_IDS,
  WATCH_PARTY_PERMISSIONS,
  type WatchPartyPermission,
  type WatchPartyPermissionEntry,
} from './watch-party-permissions';
import type { MemberKind } from './watch-party-principal';

/** A preset only chooses Member's starting permissions; a room records none after creation. */
export const WATCH_PARTY_PRESETS = ['friends', 'public'] as const;
export type WatchPartyPreset = (typeof WATCH_PARTY_PRESETS)[number];

export const ROLE_KINDS = ['grant', 'restrict'] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export const BUILT_IN_ROLE_KEYS = [
  'owner',
  'cohost',
  'moderator',
  'chat_muted',
  'voice_muted',
  'spectator',
  'dj',
  'speaker',
  'vip',
  'member',
  'guest',
] as const;
export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];

/** Never a `watch_party_member_roles` row: the owner is `owner_key`, Member and Guest are implicit. */
export const IMPLICIT_ROLE_KEYS: readonly BuiltInRoleKey[] = ['owner', 'member', 'guest'];

export const ROLE_POSITIONS = {
  owner: 1000,
  member: 1,
  guest: 0,
  customMin: 2,
  customMax: 999,
} as const;

export const MAX_CUSTOM_ROLES = 14;

export const ROLE_EXPIRIES = ['10m', '1h', 'party'] as const;
export type RoleExpiry = (typeof ROLE_EXPIRIES)[number];

/** `party` lasts as long as the room, so it carries no expiry. */
export const ROLE_EXPIRY_MS: Readonly<Record<RoleExpiry, number | null>> = {
  '10m': 10 * MS_PER_MINUTE,
  '1h': MS_PER_HOUR,
  party: null,
};

export interface BuiltInRole {
  readonly key: BuiltInRoleKey;
  readonly kind: RoleKind;
  readonly position: number;
  readonly name: string;
  readonly colour: string | null;
}

export const BUILT_IN_ROLES: readonly BuiltInRole[] = [
  { key: 'owner', kind: 'grant', position: ROLE_POSITIONS.owner, name: 'Owner', colour: '#e8a33d' },
  { key: 'cohost', kind: 'grant', position: 800, name: 'Co-host', colour: '#9b6bdf' },
  { key: 'moderator', kind: 'grant', position: 600, name: 'Moderator', colour: '#3fa66b' },
  { key: 'chat_muted', kind: 'restrict', position: 520, name: 'Chat muted', colour: null },
  { key: 'voice_muted', kind: 'restrict', position: 510, name: 'Voice muted', colour: null },
  { key: 'spectator', kind: 'restrict', position: 500, name: 'Spectator', colour: null },
  { key: 'dj', kind: 'grant', position: 400, name: 'DJ', colour: '#3d8be8' },
  { key: 'speaker', kind: 'grant', position: 300, name: 'Speaker', colour: '#2aa7a0' },
  { key: 'vip', kind: 'grant', position: 200, name: 'VIP', colour: '#d9579b' },
  { key: 'member', kind: 'grant', position: ROLE_POSITIONS.member, name: 'Member', colour: null },
  { key: 'guest', kind: 'grant', position: ROLE_POSITIONS.guest, name: 'Guest', colour: null },
];

export interface RoomRole {
  readonly id: string;
  /** The built-in role's key; `null` for a custom role. */
  readonly key: BuiltInRoleKey | null;
  readonly kind: RoleKind;
  readonly name: string;
  readonly colour: string | null;
  readonly position: number;
  readonly permissions: readonly WatchPartyPermission[];
}

interface RoleAssignment {
  readonly roleId: string;
  readonly expiresAt: Date | null;
}

function holdsByDefault(
  entry: WatchPartyPermissionEntry,
  key: BuiltInRoleKey,
  preset: WatchPartyPreset
): boolean {
  switch (key) {
    case 'owner':
    case 'spectator':
      return true;
    case 'member':
      return entry.member.includes(preset);
    case 'guest':
      return entry.roles.includes(key) && (GUEST_CEILING as readonly string[]).includes(entry.id);
    default:
      return entry.roles.includes(key);
  }
}

function defaultRolePermissions(
  key: BuiltInRoleKey,
  preset: WatchPartyPreset
): WatchPartyPermission[] {
  return WATCH_PARTY_PERMISSIONS.filter((entry) => holdsByDefault(entry, key, preset)).map(
    (entry) => entry.id
  );
}

/** The eleven rows a new room writes, and what applying a preset resets every one but Owner to. */
export function builtInRoles(preset: WatchPartyPreset): Omit<RoomRole, 'id'>[] {
  return BUILT_IN_ROLES.map(({ key, kind, position, name, colour }) => ({
    key,
    kind,
    position,
    name,
    colour,
    permissions: defaultRolePermissions(key, preset),
  }));
}

export interface EffectivePermissionsInput {
  readonly kind: MemberKind;
  readonly isOwner: boolean;
  /** Every role of the room, Member's and Guest's included. */
  readonly roles: readonly RoomRole[];
  readonly assignments: readonly RoleAssignment[];
  readonly now: Date;
}

export interface EffectivePermissions {
  readonly permissions: readonly WatchPartyPermission[];
  /** The highest position among the member's grant roles: decides whom and what they may touch. */
  readonly topPosition: number;
}

/**
 * What a member may do now. The owner holds everything; a guest holds Guest's set within the
 * ceiling, whatever rows exist; anyone else holds Member's set and every unexpired grant role's,
 * minus what every unexpired restrict role removes.
 */
export function effectivePermissions(input: EffectivePermissionsInput): EffectivePermissions {
  const { kind, isOwner, roles, assignments, now } = input;
  if (isOwner)
    return { permissions: WATCH_PARTY_PERMISSION_IDS, topPosition: ROLE_POSITIONS.owner };

  const byKey = (key: BuiltInRoleKey) => roles.find((role) => role.key === key)?.permissions ?? [];
  if (kind === 'guest') {
    return {
      permissions: byKey('guest').filter((permission) => GUEST_CEILING.includes(permission)),
      topPosition: ROLE_POSITIONS.guest,
    };
  }

  const held = assignments
    .filter(({ expiresAt }) => expiresAt === null || expiresAt > now)
    .map(({ roleId }) => roles.find((role) => role.id === roleId))
    .filter(
      (role): role is RoomRole =>
        role !== undefined && (role.key === null || !IMPLICIT_ROLE_KEYS.includes(role.key))
    );
  const grants = held.filter((role) => role.kind === 'grant');
  const removed = new Set(
    held.filter((role) => role.kind === 'restrict').flatMap((role) => role.permissions)
  );
  const granted = new Set([...byKey('member'), ...grants.flatMap((role) => role.permissions)]);

  return {
    permissions: WATCH_PARTY_PERMISSION_IDS.filter(
      (permission) => granted.has(permission) && !removed.has(permission)
    ),
    topPosition: Math.max(ROLE_POSITIONS.member, ...grants.map((role) => role.position)),
  };
}

/**
 * A room last upgraded at `fromVersion` gains every later registry entry on its built-in roles,
 * per their defaults; custom roles never gain one. Member gains an entry only when every preset
 * gives it, because the room no longer knows which preset it started from.
 */
export function upgradeRoomRoles<R extends RoomRole>(
  roles: readonly R[],
  fromVersion: number,
  registry: readonly WatchPartyPermissionEntry[] = WATCH_PARTY_PERMISSIONS
): { roles: R[]; version: number } {
  const version = Math.max(fromVersion, ...registry.map((entry) => entry.since));
  const added = registry.filter((entry) => entry.since > fromVersion);
  const upgraded = roles.map((role) => {
    const { key } = role;
    if (key === null) return role;
    const gained = added
      .filter((entry) =>
        key === 'member'
          ? entry.member.length === WATCH_PARTY_PRESETS.length
          : holdsByDefault(entry, key, 'friends')
      )
      .map((entry) => entry.id as WatchPartyPermission);
    return gained.length === 0 ? role : { ...role, permissions: [...role.permissions, ...gained] };
  });
  return { roles: upgraded, version };
}
