import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import type { WatchPartyPermission } from '@vp/domain';
import { getUserPermissions } from '../ability';
import { defineWatchPartyRoomRules } from '../rules/watch-party.rules';
import type {
  UserContext,
  WatchPartyAbility,
  WatchPartyMemberAction,
  WatchPartyMemberSubject,
  WatchPartyResource,
  WatchPartyRoleAction,
  WatchPartyRoleSubject,
  WatchPartyViewer,
} from '../types/index';

/** The ability every room action on the server, REST or socket, is decided through. */
export function getWatchPartyPermissions(
  user: UserContext | null,
  viewer: WatchPartyViewer
): WatchPartyAbility {
  const builder = new AbilityBuilder<WatchPartyAbility>(createMongoAbility);
  defineWatchPartyRoomRules(user, viewer, builder);
  return builder.build();
}

export function canInRoom(ability: WatchPartyAbility, permission: WatchPartyPermission): boolean {
  return ability.can(permission, 'WatchParty');
}

export function canGrantPermission(
  ability: WatchPartyAbility,
  permission: WatchPartyPermission
): boolean {
  return ability.can('grant', subject('WatchPartyPermission', { id: permission }));
}

export function canTouchRole(
  ability: WatchPartyAbility,
  action: WatchPartyRoleAction,
  role: WatchPartyRoleSubject
): boolean {
  return ability.can(action, subject('WatchPartyRole', { ...role }));
}

export function canActOnMember(
  ability: WatchPartyAbility,
  action: WatchPartyMemberAction,
  member: WatchPartyMemberSubject
): boolean {
  return ability.can(action, subject('WatchPartyMember', { ...member }));
}

export function canCreateWatchParty(user: UserContext | null): boolean {
  return getUserPermissions(user).can('create', 'WatchParty');
}

export function canReadWatchParty(user: UserContext | null, room: WatchPartyResource): boolean {
  return getUserPermissions(user).can('read', subject('WatchParty', { ...room }));
}
