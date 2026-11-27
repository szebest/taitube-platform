import * as schema from '@vp/db';
import { WATCH_PARTY_PERMISSION_IDS, type WatchPartyPermission } from '@vp/domain';
import { inArray } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { watchPartyRolePermissions: rolePermissions } = schema;

export interface RolePermissions {
  readonly id: string;
  readonly permissions: readonly string[];
}

/** Every role asked for, in registry order; a stored id the registry no longer knows is left out. */
export async function permissionsByRole(
  tx: PostgresDatabase,
  roleIds: readonly string[]
): Promise<Map<string, WatchPartyPermission[]>> {
  if (roleIds.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds));
  const stored = new Map<string, Set<string>>();
  for (const { roleId, permission } of rows) {
    stored.set(roleId, new Set(stored.get(roleId)).add(permission));
  }
  return new Map(
    roleIds.map((id) => [id, WATCH_PARTY_PERMISSION_IDS.filter((p) => stored.get(id)?.has(p))])
  );
}

/** Each role ends up with exactly the permissions it is given. */
export async function replacePermissions(
  tx: PostgresDatabase,
  roles: readonly RolePermissions[]
): Promise<void> {
  if (roles.length === 0) return;
  await tx.delete(rolePermissions).where(
    inArray(
      rolePermissions.roleId,
      roles.map(({ id }) => id)
    )
  );
  const rows = roles.flatMap(({ id: roleId, permissions }) =>
    permissions.map((permission) => ({ roleId, permission }))
  );
  if (rows.length > 0) await tx.insert(rolePermissions).values(rows);
}
