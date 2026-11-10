import type {
  NewWatchPartyRole,
  RolePatchWrite,
  RolesChange,
  RoleWrite,
  WatchPartyRoleRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type BuiltInRoleKey,
  type WatchPartyMemberRole,
  type WatchPartyPermission,
  type WatchPartyRoleRecord,
} from '@vp/domain';
import {
  type DatabaseUnavailable,
  databaseUnavailable,
  ErrorCodes,
  versionConflict,
} from '@vp/errors';
import { err, fromPromise, map, ok, type Result } from '@vp/result';
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../pg-errors';
import type { PostgresDatabase } from './types';
import { permissionsByRole, replacePermissions } from './watch-party-role-permissions';
import { bumpRolesVersion, insertSystemLine, lockRoom } from './watch-party-writes';

const { watchPartyRoles: roles, watchPartyMemberRoles: memberRoles } = schema;

const CONFLICT = { type: 'conflict' } as const;
const MISSING = { type: 'missing' } as const;

type Tx = PostgresDatabase;
type Outcome<T> =
  | { readonly type: 'applied'; readonly value: T }
  | typeof CONFLICT
  | typeof MISSING;

function toRecord(
  row: typeof roles.$inferSelect,
  permissions: readonly WatchPartyPermission[]
): WatchPartyRoleRecord {
  return { ...row, permissions };
}

export class PostgresWatchPartyRoleRepository implements WatchPartyRoleRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(
    roomId: string,
    now: Date
  ): Promise<Result<(WatchPartyRoleRecord & { memberCount: number })[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const rows = await tx
            .select()
            .from(roles)
            .where(eq(roles.roomId, roomId))
            .orderBy(desc(roles.position));
          const permissions = await permissionsByRole(
            tx,
            rows.map(({ id }) => id)
          );
          const holders = await tx
            .select({ roleId: memberRoles.roleId, count: sql<number>`count(*)::int` })
            .from(memberRoles)
            .where(
              and(
                eq(memberRoles.roomId, roomId),
                or(isNull(memberRoles.expiresAt), gt(memberRoles.expiresAt, now))
              )
            )
            .groupBy(memberRoles.roleId);
          const counts = new Map(holders.map(({ roleId, count }) => [roleId, count]));
          return rows.map((row) => ({
            ...toRecord(row, permissions.get(row.id) ?? []),
            memberCount: counts.get(row.id) ?? 0,
          }));
        }),
      databaseUnavailable.during('listWatchPartyRoles')
    );
  }

  async assignmentsIn(
    roomId: string
  ): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>> {
    return fromPromise(
      () => this.db.select().from(memberRoles).where(eq(memberRoles.roomId, roomId)),
      databaseUnavailable.during('listWatchPartyAssignments')
    );
  }

  async assignmentsOf(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(memberRoles)
          .where(and(eq(memberRoles.roomId, roomId), eq(memberRoles.memberKey, memberKey))),
      databaseUnavailable.during('listWatchPartyMemberAssignments')
    );
  }

  async create(
    role: NewWatchPartyRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>> {
    const { permissions, ...columns } = role;
    return this.write('createWatchPartyRole', role.roomId, change, async (tx) => {
      const [row] = await tx
        .insert(roles)
        .values({ ...columns, createdAt: change.at, updatedAt: change.at })
        .returning();
      if (!row) return MISSING;
      await replacePermissions(tx, [{ id: role.id, permissions }]);
      return { type: 'applied', value: toRecord(row, permissions) };
    });
  }

  async update(
    roomId: string,
    roleId: string,
    patch: RolePatchWrite,
    expectedUpdatedAt: Date,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>> {
    const { permissions, ...columns } = patch;
    return this.write('updateWatchPartyRole', roomId, change, async (tx) => {
      const [row] = await tx
        .update(roles)
        .set({ ...columns, updatedAt: change.at })
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.roomId, roomId),
            eq(roles.updatedAt, expectedUpdatedAt)
          )
        )
        .returning();
      if (!row) {
        const [existing] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.id, roleId), eq(roles.roomId, roomId)));
        return existing ? CONFLICT : MISSING;
      }
      if (permissions) {
        await replacePermissions(tx, [{ id: roleId, permissions }]);
      }
      const held = permissions ?? (await permissionsByRole(tx, [roleId])).get(roleId) ?? [];
      return { type: 'applied', value: toRecord(row, held) };
    });
  }

  async remove(
    roomId: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return this.write('removeWatchPartyRole', roomId, change, async (tx) => {
      const removed = await tx
        .delete(roles)
        .where(and(eq(roles.id, roleId), eq(roles.roomId, roomId)))
        .returning({ id: roles.id });
      return removed.length === 0 ? MISSING : { type: 'applied', value: null };
    });
  }

  async resetBuiltIns(
    roomId: string,
    reset: readonly {
      readonly key: BuiltInRoleKey;
      readonly permissions: readonly WatchPartyPermission[];
    }[],
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return this.write('resetWatchPartyBuiltInRoles', roomId, change, async (tx) => {
      const built = await tx
        .select({ id: roles.id, key: roles.key })
        .from(roles)
        .where(
          and(
            eq(roles.roomId, roomId),
            inArray(
              roles.key,
              reset.map(({ key }) => key)
            )
          )
        );
      const idOf = new Map(built.map(({ id, key }) => [key, id]));
      await replacePermissions(
        tx,
        reset.flatMap(({ key, permissions }) => {
          const id = idOf.get(key);
          return id ? [{ id, permissions }] : [];
        })
      );
      return { type: 'applied', value: null };
    });
  }

  async assign(
    assignment: WatchPartyMemberRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyMemberRole>, DatabaseUnavailable>> {
    return this.write('assignWatchPartyRole', assignment.roomId, change, async (tx) => {
      const { expiresAt, grantedBy } = assignment;
      const [row] = await tx
        .insert(memberRoles)
        .values(assignment)
        .onConflictDoUpdate({
          target: [memberRoles.roomId, memberRoles.memberKey, memberRoles.roleId],
          set: { expiresAt, grantedBy },
        })
        .returning();
      return row ? { type: 'applied', value: row } : MISSING;
    });
  }

  async revoke(
    roomId: string,
    memberKey: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return this.write('revokeWatchPartyRole', roomId, change, async (tx) => {
      const revoked = await tx
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.roomId, roomId),
            eq(memberRoles.memberKey, memberKey),
            eq(memberRoles.roleId, roleId)
          )
        )
        .returning({ roleId: memberRoles.roleId });
      return revoked.length === 0 ? MISSING : { type: 'applied', value: null };
    });
  }

  async deleteExpired(now: Date): Promise<Result<number, DatabaseUnavailable>> {
    const deleted = await fromPromise(
      () =>
        this.db
          .delete(memberRoles)
          .where(lte(memberRoles.expiresAt, now))
          .returning({ roleId: memberRoles.roleId }),
      databaseUnavailable.during('deleteExpiredWatchPartyRoles')
    );
    return map(deleted, (rows) => rows.length);
  }

  /**
   * Locks the room row first, so role changes in a room run one at a time and a command racing
   * one reads the new `roles_version`. A unique violation rolls the whole transaction back.
   */
  private async write<T>(
    operation: string,
    roomId: string,
    change: RolesChange,
    body: (tx: Tx) => Promise<Outcome<T>>
  ): Promise<Result<RoleWrite<T>, DatabaseUnavailable>> {
    const done = await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<RoleWrite<T>> => {
          if (!(await lockRoom(tx, roomId))) return MISSING;
          const outcome = await body(tx);
          if (outcome.type !== 'applied') return outcome;
          const rolesVersion = await bumpRolesVersion(tx, roomId, change.at);
          if (rolesVersion === null) return MISSING;
          await insertSystemLine(tx, roomId, change.line);
          return { type: 'applied', value: outcome.value, rolesVersion };
        }),
      (cause) =>
        isUniqueViolation(cause) ? versionConflict(roomId) : databaseUnavailable(operation, cause)
    );
    if (done.ok) return done;
    return done.error.code === ErrorCodes.VERSION_CONFLICT ? ok(CONFLICT) : err(done.error);
  }
}
