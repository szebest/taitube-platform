import { IMPLICIT_ROLE_KEYS, type RoomRole, type WatchPartyPermission } from '@vp/domain';
import {
  type WatchPartyPermissionMissing,
  type WatchPartyRoleEscalation,
  watchPartyRoleEscalation,
} from '@vp/errors';
import {
  canActOnMember,
  canTouchRole,
  type WatchPartyAbility,
  type WatchPartyMemberSubject,
} from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { requireRoomPermission } from './permission.rule';

export interface RoleAssignInput {
  readonly ability: WatchPartyAbility;
  readonly actorKey: string;
  readonly target: WatchPartyMemberSubject & { readonly memberKey: string };
  readonly role: RoomRole;
}

export type RoleAssignFailure = WatchPartyPermissionMissing | WatchPartyRoleEscalation;

/** The mutes are moderation, each under its own permission; every other role is `roles.assign`. */
function governing(role: RoomRole): WatchPartyPermission {
  switch (role.key) {
    case 'chat_muted':
      return 'chat.moderate';
    case 'voice_muted':
      return 'voice.moderate';
    default:
      return 'roles.assign';
  }
}

function decideChange(
  input: RoleAssignInput,
  action: 'assign' | 'revoke'
): Result<RoomRole, RoleAssignFailure> {
  const { ability, target, role } = input;
  const permission = governing(role);
  return andThen(requireRoomPermission(ability, permission), () => {
    const onMember = permission === 'roles.assign' ? 'assign' : 'mute';
    return canTouchRole(ability, action, role) && canActOnMember(ability, onMember, target)
      ? ok(role)
      : err(watchPartyRoleEscalation());
  });
}

function isImplicit(role: RoomRole): boolean {
  return role.key !== null && IMPLICIT_ROLE_KEYS.includes(role.key);
}

/** Owner, Member and Guest are never rows; nobody gives themselves a role; no guest holds one. */
export function decideRoleAssign(input: RoleAssignInput): Result<RoomRole, RoleAssignFailure> {
  const { actorKey, target, role } = input;
  if (isImplicit(role) || target.kind === 'guest' || target.memberKey === actorKey) {
    return err(watchPartyRoleEscalation());
  }
  return decideChange(input, 'assign');
}

/** Anyone drops a grant role they hold; nobody lifts their own mute or Spectator. */
export function decideRoleRevoke(input: RoleAssignInput): Result<RoomRole, RoleAssignFailure> {
  const { actorKey, target, role } = input;
  if (isImplicit(role)) return err(watchPartyRoleEscalation());
  if (target.memberKey === actorKey) {
    return role.kind === 'grant' ? ok(role) : err(watchPartyRoleEscalation());
  }
  return decideChange(input, 'revoke');
}
