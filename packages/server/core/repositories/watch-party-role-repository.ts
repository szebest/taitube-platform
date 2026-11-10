import type {
  BuiltInRoleKey,
  WatchPartyMemberRole,
  WatchPartyPermission,
  WatchPartyRoleRecord,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewSystemLine } from './watch-party-room-repository';

/** Every role change bumps `roles_version` and writes its system line in the same transaction. */
export interface RolesChange {
  readonly line: NewSystemLine;
  readonly at: Date;
}

export type NewWatchPartyRole = Omit<WatchPartyRoleRecord, 'createdAt' | 'updatedAt'>;

export interface RolePatchWrite {
  readonly name?: string;
  readonly colour?: string | null;
  readonly position?: number;
  readonly permissions?: readonly WatchPartyPermission[];
}

export type RoleWrite<T> =
  | { readonly type: 'applied'; readonly value: T; readonly rolesVersion: number }
  | { readonly type: 'conflict' }
  | { readonly type: 'missing' };

export interface WatchPartyRoleRepositoryPort {
  /** Highest position first, each with its permissions and how many unexpired holders it has. */
  list(
    roomId: string,
    now: Date
  ): Promise<Result<(WatchPartyRoleRecord & { memberCount: number })[], DatabaseUnavailable>>;
  /** Expired rows too: `effectivePermissions` ignores them, the sweep deletes them. */
  assignmentsIn(roomId: string): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>>;
  assignmentsOf(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>>;
  create(
    role: NewWatchPartyRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>>;
  /** Guarded by the `updatedAt` the editor read: an older one is `conflict`. */
  update(
    roomId: string,
    roleId: string,
    patch: RolePatchWrite,
    expectedUpdatedAt: Date,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>>;
  /** Its holders lose it with it. */
  remove(
    roomId: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>>;
  /** A preset: the built-in roles named get exactly these permissions; nothing else changes. */
  resetBuiltIns(
    roomId: string,
    roles: readonly {
      readonly key: BuiltInRoleKey;
      readonly permissions: readonly WatchPartyPermission[];
    }[],
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>>;
  /** Assigning a role already held replaces its expiry. */
  assign(
    assignment: WatchPartyMemberRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyMemberRole>, DatabaseUnavailable>>;
  revoke(
    roomId: string,
    memberKey: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>>;
  deleteExpired(now: Date): Promise<Result<number, DatabaseUnavailable>>;
}
