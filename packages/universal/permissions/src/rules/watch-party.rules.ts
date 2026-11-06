import type { AbilityBuilder } from '@casl/ability';
import { PLATFORM_STAFF_PERMISSIONS, type BuiltInRoleKey } from '@vp/domain';
import {
  type AppAbility,
  isSignedInRole,
  type UserContext,
  type WatchPartyAbility,
  type WatchPartyViewer,
} from '../types/index';

const MUTE_ROLES: readonly BuiltInRoleKey[] = ['chat_muted', 'voice_muted'];
const NEVER_ASSIGNED: readonly BuiltInRoleKey[] = ['owner', 'member', 'guest', ...MUTE_ROLES];

function isPlatformStaff(user: UserContext | null): boolean {
  return user?.role === 'MODERATOR' || user?.role === 'ADMIN';
}

/** Creating a room and reading its preview: everything else in a room is the room-scoped ability. */
export function defineWatchPartyRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (user && isSignedInRole(user.role)) builder.can('create', 'WatchParty');
  builder.can('read', 'WatchParty', { visibility: { $in: ['public', 'unlisted'] } });
  builder.can('read', 'WatchParty', { isMember: true });
  builder.can('read', 'WatchParty', { hasGrant: true });
}

/**
 * Each held permission becomes `can(permission, 'WatchParty')`; the hierarchy becomes conditions:
 * nobody touches a role or a member at or above their own top position, grants a permission they
 * lack, or changes a guest's roles. Platform staff kick, ban, mute and close in any room, and never
 * touch any other role.
 */
export function defineWatchPartyRoomRules(
  user: UserContext | null,
  viewer: WatchPartyViewer,
  builder: AbilityBuilder<WatchPartyAbility>
): void {
  const { can, cannot } = builder;
  const held = new Set(viewer.permissions);
  const below = { $lt: viewer.topPosition };
  const memberBelow = { topPosition: below, isOwner: false };

  for (const permission of held) can(permission, 'WatchParty');
  can('grant', 'WatchPartyPermission', { id: { $in: [...held] } });

  if (held.has('roles.assign')) {
    can(['assign', 'revoke'], 'WatchPartyRole', {
      position: below,
      key: { $nin: [...NEVER_ASSIGNED] },
    });
    can('assign', 'WatchPartyMember', memberBelow);
  }
  if (held.has('chat.moderate')) {
    can(['assign', 'revoke'], 'WatchPartyRole', { key: 'chat_muted', position: below });
  }
  if (held.has('voice.moderate')) {
    can(['assign', 'revoke'], 'WatchPartyRole', { key: 'voice_muted', position: below });
  }
  if (held.has('chat.moderate') || held.has('voice.moderate')) {
    can('mute', 'WatchPartyMember', memberBelow);
  }
  if (held.has('roles.manage')) {
    can(['create', 'update', 'delete', 'move'], 'WatchPartyRole', {
      position: below,
      key: { $ne: 'owner' },
    });
  }
  if (held.has('members.kick')) can('kick', 'WatchPartyMember', memberBelow);
  if (held.has('members.ban')) can('ban', 'WatchPartyMember', memberBelow);

  if (isPlatformStaff(user)) {
    for (const permission of PLATFORM_STAFF_PERMISSIONS) can(permission, 'WatchParty');
    can(['kick', 'ban', 'mute'], 'WatchPartyMember', { isOwner: false });
    can(['assign', 'revoke'], 'WatchPartyRole', { key: { $in: [...MUTE_ROLES] } });
  }

  cannot(['assign', 'mute'], 'WatchPartyMember', { kind: 'guest' });
}
