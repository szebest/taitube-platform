import type {
  WatchPartyRoleList,
  WatchPartyRoleView,
  WatchPartyServerFrame,
} from '@vp/api-contracts';
import type { WatchPartyMemberRole, WatchPartyRoleRecord, WatchPartyRoom } from '@vp/domain';

type CountedRole = WatchPartyRoleRecord & { readonly memberCount: number };

export function toRoleView(role: CountedRole): WatchPartyRoleView {
  const { id, key, kind, name, colour, position, permissions, memberCount, updatedAt } = role;
  return {
    id,
    key,
    kind,
    name,
    colour,
    position,
    permissions: [...permissions],
    memberCount,
    updatedAt: updatedAt.toISOString(),
  };
}

export function toRoleList(
  roles: readonly CountedRole[],
  room: Pick<WatchPartyRoom, 'rolesVersion' | 'permissionsVersion'>
): WatchPartyRoleList {
  return {
    items: roles.map(toRoleView),
    rolesVersion: room.rolesVersion,
    permissionsVersion: room.permissionsVersion,
  };
}

export function memberRolesFrame(
  memberKey: string,
  assignments: readonly WatchPartyMemberRole[],
  rolesVersion: number,
  now: Date
): Extract<WatchPartyServerFrame, { type: 'member.roles' }> {
  const held = assignments.filter(
    (row) => row.memberKey === memberKey && (row.expiresAt === null || row.expiresAt > now)
  );
  return {
    type: 'member.roles',
    memberKey,
    roleIds: held.map((row) => row.roleId),
    expiries: Object.fromEntries(
      held.map((row) => [row.roleId, row.expiresAt?.toISOString() ?? null])
    ),
    rolesVersion,
  };
}
