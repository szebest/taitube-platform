import {
  GUEST_CEILING,
  MAX_CUSTOM_ROLES,
  ROLE_POSITIONS,
  type RoleKind,
  type RoomRole,
  type WatchPartyPermission,
} from '@vp/domain';
import {
  type WatchPartyPermissionMissing,
  type WatchPartyRoleEscalation,
  type WatchPartyRoleLimit,
  type WatchPartyRoleProtected,
  watchPartyRoleEscalation,
  watchPartyRoleLimit,
  watchPartyRoleProtected,
} from '@vp/errors';
import { canGrantPermission, canTouchRole, type WatchPartyAbility } from '@vp/permissions';
import { andThen, err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import { requireRoomPermission } from './permission.rule';

export type InvalidRolePosition = InvalidField<{ min: number; max: number }>;

export type RoleEditFailure =
  | WatchPartyPermissionMissing
  | WatchPartyRoleEscalation
  | WatchPartyRoleProtected
  | WatchPartyRoleLimit
  | InvalidRolePosition;

interface RoleEditContext {
  readonly roomId: string;
  readonly ability: WatchPartyAbility;
  /** The editor's top position: a new role goes below it. */
  readonly topPosition: number;
  readonly roles: readonly RoomRole[];
}

export interface RoleDraft {
  readonly kind: RoleKind;
  readonly position?: number;
  readonly permissions: readonly WatchPartyPermission[];
}

export interface RolePatch {
  readonly name?: string;
  readonly colour?: string | null;
  readonly position?: number;
  readonly permissions?: readonly WatchPartyPermission[];
}

function invalidPosition(): InvalidRolePosition {
  const bounds = { min: ROLE_POSITIONS.customMin, max: ROLE_POSITIONS.customMax };
  return invalidField('position', 'position must be a free slot from 2 to 999', bounds);
}

function freePosition(roles: readonly RoomRole[], position: number): boolean {
  return (
    Number.isInteger(position) &&
    position >= ROLE_POSITIONS.customMin &&
    position <= ROLE_POSITIONS.customMax &&
    !roles.some((role) => role.position === position)
  );
}

/** Rule 1: nobody puts a permission they lack into a role, granting or removing. */
function grantsOnly(
  ability: WatchPartyAbility,
  added: readonly WatchPartyPermission[]
): Result<void, WatchPartyRoleEscalation> {
  return added.every((permission) => canGrantPermission(ability, permission))
    ? ok(undefined)
    : err(watchPartyRoleEscalation());
}

/** A new custom role at the given free position, or the highest free one below the editor. */
export function decideRoleCreate(
  context: RoleEditContext,
  draft: RoleDraft
): Result<{ readonly position: number }, RoleEditFailure> {
  const { roomId, ability, topPosition, roles } = context;
  return andThen(requireRoomPermission(ability, 'roles.manage'), () => {
    if (roles.filter((role) => role.key === null).length >= MAX_CUSTOM_ROLES) {
      return err(watchPartyRoleLimit(roomId));
    }
    const highestFree = Array.from(
      { length: topPosition },
      (_, index) => topPosition - 1 - index
    ).find((position) => freePosition(roles, position));
    const position = draft.position ?? highestFree;
    if (position === undefined) return err(watchPartyRoleLimit(roomId));
    if (!canTouchRole(ability, 'create', { key: null, position }))
      return err(watchPartyRoleEscalation());
    if (!freePosition(roles, position)) return err(invalidPosition());
    return andThen(grantsOnly(ability, draft.permissions), () => ok({ position }));
  });
}

function decideOwnerRoleEdit(
  role: RoomRole,
  patch: RolePatch,
  isOwner: boolean
): Result<RolePatch, RoleEditFailure> {
  if (!isOwner) return err(watchPartyRoleEscalation());
  if (patch.permissions !== undefined || patch.position !== undefined) {
    return err(watchPartyRoleProtected(role.id));
  }
  return ok(patch);
}

/**
 * Owner's name and colour are the owner's alone; Member and Guest never move; Guest never passes
 * its ceiling; every other change is below the editor's position and grants only what they hold.
 */
export function decideRoleUpdate(
  context: RoleEditContext & { readonly isOwner: boolean },
  role: RoomRole,
  patch: RolePatch
): Result<RolePatch, RoleEditFailure> {
  const { ability, roles, isOwner } = context;
  if (role.key === 'owner') return decideOwnerRoleEdit(role, patch, isOwner);

  return andThen(requireRoomPermission(ability, 'roles.manage'), () => {
    if (!canTouchRole(ability, 'update', role)) return err(watchPartyRoleEscalation());
    if (patch.position !== undefined && patch.position !== role.position) {
      if (role.key === 'member' || role.key === 'guest')
        return err(watchPartyRoleProtected(role.id));
      if (!canTouchRole(ability, 'move', { key: role.key, position: patch.position })) {
        return err(watchPartyRoleEscalation());
      }
      if (!freePosition(roles, patch.position)) return err(invalidPosition());
    }
    const added = (patch.permissions ?? []).filter((id) => !role.permissions.includes(id));
    if (role.key === 'guest' && patch.permissions?.some((id) => !GUEST_CEILING.includes(id))) {
      return err(watchPartyRoleEscalation());
    }
    return andThen(grantsOnly(ability, added), () => ok(patch));
  });
}

/** Built-in roles are never deleted; a custom one only below the editor's position. */
export function decideRoleDelete(
  context: Pick<RoleEditContext, 'ability'>,
  role: RoomRole
): Result<RoomRole, RoleEditFailure> {
  if (role.key !== null) return err(watchPartyRoleProtected(role.id));
  return andThen(requireRoomPermission(context.ability, 'roles.manage'), () =>
    canTouchRole(context.ability, 'delete', role) ? ok(role) : err(watchPartyRoleEscalation())
  );
}
