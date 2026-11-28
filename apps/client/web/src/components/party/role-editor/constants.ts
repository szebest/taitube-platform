import { GUEST_CEILING, WATCH_PARTY_PERMISSIONS, type WatchPartyPermission } from '@vp/domain';

export const PERMISSION_GROUPS = [
  'playback',
  'queue',
  'chat',
  'voice',
  'members',
  'room',
  'roles',
] as const;

type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

/** What a role may hold, by group; Guest offers only its ceiling and voice waits for voice to be on. */
export function getOfferedPermissions(
  roleKey: string | null,
  voice: boolean
): Record<PermissionGroup, WatchPartyPermission[]> {
  const offered = WATCH_PARTY_PERMISSIONS.filter(
    (entry) =>
      (roleKey !== 'guest' || GUEST_CEILING.includes(entry.id)) &&
      (voice || entry.group !== 'voice')
  );

  return Object.fromEntries(
    PERMISSION_GROUPS.map((group) => [
      group,
      offered.filter((entry) => entry.group === group).map((entry) => entry.id),
    ])
  ) as Record<PermissionGroup, WatchPartyPermission[]>;
}
