import { type AbilityBuilder, subject } from '@casl/ability';
import { createAbilityFactory } from '@kit/permissions';
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

interface RoomContext {
  readonly user: UserContext | null;
  readonly viewer: WatchPartyViewer;
}

const buildRoomAbility = createAbilityFactory([
  ({ user, viewer }: RoomContext, builder: AbilityBuilder<WatchPartyAbility>) =>
    defineWatchPartyRoomRules(user, viewer, builder),
]);

/** The ability every room action on the server, REST or socket, is decided through. */
export function getWatchPartyPermissions(
  user: UserContext | null,
  viewer: WatchPartyViewer
): WatchPartyAbility {
  return buildRoomAbility({ user, viewer });
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
