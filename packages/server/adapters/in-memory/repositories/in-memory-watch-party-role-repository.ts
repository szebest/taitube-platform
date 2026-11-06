import type {
  NewWatchPartyRole,
  RolePatchWrite,
  RolesChange,
  RoleWrite,
  WatchPartyRoleRepositoryPort,
} from '@vp/core/repositories';
import {
  type BuiltInRoleKey,
  WATCH_PARTY_PERMISSION_IDS,
  type WatchPartyMemberRole,
  type WatchPartyPermission,
  type WatchPartyRoleRecord,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { assignmentKey, type InMemoryWatchPartyStore } from './in-memory-watch-party-store';

const CONFLICT = { type: 'conflict' } as const;
const MISSING = { type: 'missing' } as const;

type Outcome<T> =
  | { readonly type: 'applied'; readonly value: T }
  | typeof CONFLICT
  | typeof MISSING;

const copyOf = (role: WatchPartyRoleRecord): WatchPartyRoleRecord => ({
  ...role,
  permissions: WATCH_PARTY_PERMISSION_IDS.filter((id) => role.permissions.includes(id)),
});

export class InMemoryWatchPartyRoleRepository implements WatchPartyRoleRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async list(
    roomId: string,
    now: Date
  ): Promise<Result<(WatchPartyRoleRecord & { memberCount: number })[], DatabaseUnavailable>> {
    const unexpired = [...this.store.memberRoles.values()].filter(
      (row) => row.roomId === roomId && (row.expiresAt === null || row.expiresAt > now)
    );
    const listed = this.rolesIn(roomId)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        ...copyOf(role),
        memberCount: unexpired.filter((row) => row.roleId === role.id).length,
      }));
    return ok(listed);
  }

  async assignmentsIn(
    roomId: string
  ): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>> {
    const rows = [...this.store.memberRoles.values()].filter((row) => row.roomId === roomId);
    return ok(rows.map((row) => ({ ...row })));
  }

  async assignmentsOf(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMemberRole[], DatabaseUnavailable>> {
    const rows = [...this.store.memberRoles.values()].filter(
      (row) => row.roomId === roomId && row.memberKey === memberKey
    );
    return ok(rows.map((row) => ({ ...row })));
  }

  async create(
    role: NewWatchPartyRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>> {
    return ok(
      this.write(role.roomId, change, () => {
        const taken =
          this.store.roles.has(role.id) ||
          this.rolesIn(role.roomId).some(
            (other) =>
              other.position === role.position || (role.key !== null && other.key === role.key)
          );
        if (taken) return CONFLICT;
        const created = {
          ...role,
          permissions: [...role.permissions],
          createdAt: change.at,
          updatedAt: change.at,
        };
        this.store.roles.set(role.id, created);
        return { type: 'applied', value: copyOf(created) };
      })
    );
  }

  async update(
    roomId: string,
    roleId: string,
    patch: RolePatchWrite,
    expectedUpdatedAt: Date,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyRoleRecord>, DatabaseUnavailable>> {
    return ok(
      this.write(roomId, change, () => {
        const role = this.store.roles.get(roleId);
        if (role?.roomId !== roomId) return MISSING;
        const moved = patch.position !== undefined && patch.position !== role.position;
        const taken =
          moved && this.rolesIn(roomId).some((other) => other.position === patch.position);
        if (role.updatedAt.getTime() !== expectedUpdatedAt.getTime() || taken) return CONFLICT;
        const { name, colour, position, permissions } = patch;
        const updated = {
          ...role,
          name: name ?? role.name,
          colour: colour === undefined ? role.colour : colour,
          position: position ?? role.position,
          permissions: permissions ?? role.permissions,
          updatedAt: change.at,
        };
        this.store.roles.set(roleId, updated);
        return { type: 'applied', value: copyOf(updated) };
      })
    );
  }

  async remove(
    roomId: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return ok(
      this.write(roomId, change, () => {
        if (this.store.roles.get(roleId)?.roomId !== roomId) return MISSING;
        this.store.roles.delete(roleId);
        for (const [key, row] of this.store.memberRoles) {
          if (row.roleId === roleId) this.store.memberRoles.delete(key);
        }
        return { type: 'applied', value: null };
      })
    );
  }

  async resetBuiltIns(
    roomId: string,
    reset: readonly {
      readonly key: BuiltInRoleKey;
      readonly permissions: readonly WatchPartyPermission[];
    }[],
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return ok(
      this.write(roomId, change, () => {
        for (const { key, permissions } of reset) {
          const role = this.rolesIn(roomId).find((other) => other.key === key);
          if (role) this.store.roles.set(role.id, { ...role, permissions: [...permissions] });
        }
        return { type: 'applied', value: null };
      })
    );
  }

  async assign(
    assignment: WatchPartyMemberRole,
    change: RolesChange
  ): Promise<Result<RoleWrite<WatchPartyMemberRole>, DatabaseUnavailable>> {
    return ok(
      this.write(assignment.roomId, change, () => {
        const { roomId, memberKey, roleId, expiresAt, grantedBy } = assignment;
        const key = assignmentKey(roomId, memberKey, roleId);
        const stored = { ...(this.store.memberRoles.get(key) ?? assignment), expiresAt, grantedBy };
        this.store.memberRoles.set(key, stored);
        return { type: 'applied', value: { ...stored } };
      })
    );
  }

  async revoke(
    roomId: string,
    memberKey: string,
    roleId: string,
    change: RolesChange
  ): Promise<Result<RoleWrite<null>, DatabaseUnavailable>> {
    return ok(
      this.write(roomId, change, () => {
        const removed = this.store.memberRoles.delete(assignmentKey(roomId, memberKey, roleId));
        return removed ? { type: 'applied', value: null } : MISSING;
      })
    );
  }

  async deleteExpired(now: Date): Promise<Result<number, DatabaseUnavailable>> {
    let deleted = 0;
    for (const [key, row] of this.store.memberRoles) {
      if (row.expiresAt !== null && row.expiresAt <= now) {
        this.store.memberRoles.delete(key);
        deleted += 1;
      }
    }
    return ok(deleted);
  }

  clear(): void {
    this.store.clear();
  }

  private rolesIn(roomId: string): WatchPartyRoleRecord[] {
    return [...this.store.roles.values()].filter((role) => role.roomId === roomId);
  }

  private write<T>(roomId: string, change: RolesChange, body: () => Outcome<T>): RoleWrite<T> {
    if (!this.store.rooms.has(roomId)) return MISSING;
    const outcome = body();
    if (outcome.type !== 'applied') return outcome;
    const rolesVersion = this.store.bumpRolesVersion(roomId, change.at);
    if (rolesVersion === null) return MISSING;
    this.store.appendSystemLine(roomId, change.line);
    return { type: 'applied', value: outcome.value, rolesVersion };
  }
}
