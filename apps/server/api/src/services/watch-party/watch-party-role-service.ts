import type {
  applyWatchPartyPreset,
  assignWatchPartyRole,
  createWatchPartyRole,
  updateWatchPartyRole,
  WatchPartyRoleList,
  WatchPartyRoleView,
} from '@vp/api-contracts';
import type { NewSystemLine, RoleWrite } from '@vp/core/repositories';
import { builtInRoles, type WatchPartyRoleRecord } from '@vp/domain';
import {
  decideRoleCreate,
  decideRoleDelete,
  decideRoleUpdate,
  requireRoomPermission,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type WatchPartyNotFound, watchPartyNotFound } from '@vp/errors';
import { andThen, andThenAsync, err, map, ok, type Result } from '@vp/result';
import { validateRoleName } from '@vp/validation';
import type { z } from 'zod';
import type { PartyCaller } from './party-caller';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { actingInRoom, roleOf } from './watch-party-member-targets';
import {
  announceLine,
  appliedOrRefused,
  logChange,
  publishRoles,
  systemLineFor,
} from './watch-party-moderation-effects';
import { assignMemberRole, revokeMemberRole } from './watch-party-role-assignments';
import { toRoleList, toRoleView } from './watch-party-role-views';
import { countRoleEscalation, inSpan } from './watch-party-telemetry';

export type CreateRoleInput = z.output<typeof createWatchPartyRole.body>;
export type UpdateRoleInput = z.output<typeof updateWatchPartyRole.body>;
export type ApplyPresetInput = z.output<typeof applyWatchPartyPreset.body>;
export type AssignRoleInput = z.output<typeof assignWatchPartyRole.body>;

type CountedRole = WatchPartyRoleRecord & { readonly memberCount: number };

interface RoleChange {
  readonly roomId: string;
  readonly actorKey: string;
  readonly action: string;
  readonly targetKey: string;
  readonly conflictId: string;
  readonly line: NewSystemLine;
}

export class WatchPartyRoleService {
  constructor(private readonly deps: WatchPartyDeps) {}

  async list(
    roomId: string,
    caller: PartyCaller
  ): Promise<Result<WatchPartyRoleList, WatchPartyNotFound | DatabaseUnavailable>> {
    const loaded = await this.deps.context.load(roomId, caller);
    return andThen(loaded, ({ room, roles, seat }) =>
      seat === null ? err(watchPartyNotFound(roomId)) : ok(toRoleList(roles, room))
    );
  }

  create(roomId: string, caller: PartyCaller, input: CreateRoleInput) {
    return this.traced('create', roomId, () =>
      actingInRoom(this.deps.context, roomId, caller, (context, actorKey) => {
        const { ability, effective, roles } = context;
        const placed = decideRoleCreate(
          { roomId, ability, topPosition: effective.topPosition, roles },
          { kind: input.kind, position: input.position, permissions: input.permissions }
        );
        return andThenAsync(placed, ({ position }) =>
          andThenAsync(validateRoleName(input.name), (name) =>
            this.insert(context, actorKey, input, name, position)
          )
        );
      })
    );
  }

  update(roomId: string, caller: PartyCaller, roleId: string, input: UpdateRoleInput) {
    return this.traced('update', roomId, () =>
      actingInRoom(this.deps.context, roomId, caller, (context, actorKey) =>
        andThenAsync(roleOf(context, roleId), (role) => {
          const { ability, effective, isOwner, roles } = context;
          const { updatedAt, ...patch } = input;
          const decided = decideRoleUpdate(
            { roomId, ability, topPosition: effective.topPosition, roles, isOwner },
            role,
            patch
          );
          const named = patch.name === undefined ? ok(undefined) : validateRoleName(patch.name);
          return andThenAsync(decided, () =>
            andThenAsync(named, async (name) => {
              const effect = this.rolesChange(context, actorKey, `updated:${role.name}`);
              const written = await this.deps.repositories.watchPartyRoles.update(
                roomId,
                roleId,
                { ...patch, ...(name === undefined ? {} : { name }) },
                new Date(updatedAt),
                effect
              );
              const change = { roomId, actorKey, action: 'role.update', targetKey: roleId };
              const settled = await this.settle(written, {
                ...change,
                conflictId: roleId,
                line: effect.line,
              });
              return map(settled, ({ value, roles: listed }) => this.viewOf(value, listed));
            })
          );
        })
      )
    );
  }

  remove(roomId: string, caller: PartyCaller, roleId: string) {
    return this.traced('delete', roomId, () =>
      actingInRoom(this.deps.context, roomId, caller, (context, actorKey) =>
        andThenAsync(roleOf(context, roleId), (role) =>
          andThenAsync(decideRoleDelete({ ability: context.ability }, role), async () => {
            const effect = this.rolesChange(context, actorKey, `deleted:${role.name}`);
            const written = await this.deps.repositories.watchPartyRoles.remove(
              roomId,
              roleId,
              effect
            );
            const change = { roomId, actorKey, action: 'role.delete', targetKey: roleId };
            const settled = await this.settle(written, {
              ...change,
              conflictId: roleId,
              line: effect.line,
            });
            return map(settled, () => undefined);
          })
        )
      )
    );
  }

  applyPreset(roomId: string, caller: PartyCaller, { preset }: ApplyPresetInput) {
    return this.traced('preset', roomId, () =>
      actingInRoom(this.deps.context, roomId, caller, (context, actorKey) =>
        andThenAsync(requireRoomPermission(context.ability, 'roles.manage'), async () => {
          const reset = builtInRoles(preset).flatMap(({ key, permissions }) =>
            key === null || key === 'owner' ? [] : [{ key, permissions }]
          );
          const effect = this.rolesChange(context, actorKey, `preset:${preset}`);
          const written = await this.deps.repositories.watchPartyRoles.resetBuiltIns(
            roomId,
            reset,
            effect
          );
          const change = { roomId, actorKey, action: 'role.preset', targetKey: preset };
          const settled = await this.settle(written, {
            ...change,
            conflictId: roomId,
            line: effect.line,
          });
          return map(settled, ({ roles, rolesVersion }) =>
            toRoleList(roles, { rolesVersion, permissionsVersion: context.room.permissionsVersion })
          );
        })
      )
    );
  }

  assign(
    roomId: string,
    caller: PartyCaller,
    memberKey: string,
    roleId: string,
    input: AssignRoleInput
  ) {
    const target = { roomId, caller, memberKey, roleId };
    return this.traced('assign', roomId, () =>
      assignMemberRole(this.deps, { ...target, expiresIn: input?.expiresIn })
    );
  }

  revoke(roomId: string, caller: PartyCaller, memberKey: string, roleId: string) {
    return this.traced('revoke', roomId, () =>
      revokeMemberRole(this.deps, { roomId, caller, memberKey, roleId })
    );
  }

  private traced<T, E extends { readonly code: string }>(
    action: string,
    roomId: string,
    run: () => Promise<Result<T, E>>
  ): Promise<Result<T, E>> {
    return inSpan('roles', { 'room.id': roomId, 'watch_party.action': action }, async () =>
      countRoleEscalation(this.deps, action, await run())
    );
  }

  private async insert(
    context: RoomContext,
    actorKey: string,
    input: CreateRoleInput,
    name: string,
    position: number
  ) {
    const { room } = context;
    const id = this.deps.secrets.newId();
    const effect = this.rolesChange(context, actorKey, `created:${name}`);
    const written = await this.deps.repositories.watchPartyRoles.create(
      {
        id,
        roomId: room.id,
        key: null,
        kind: input.kind,
        name,
        colour: input.colour ?? null,
        position,
        permissions: input.permissions,
      },
      effect
    );
    const change = { roomId: room.id, actorKey, action: 'role.create', targetKey: id };
    const settled = await this.settle(written, {
      ...change,
      conflictId: room.id,
      line: effect.line,
    });
    return map(settled, ({ value, roles }) => this.viewOf(value, roles));
  }

  private rolesChange({ room }: RoomContext, actorKey: string, detail: string) {
    const line = { event: 'roles_changed', actorKey, targetKey: null, detail } as const;
    return { line: systemLineFor(this.deps, room, line), at: this.deps.now() };
  }

  private viewOf(role: WatchPartyRoleRecord, listed: readonly CountedRole[]): WatchPartyRoleView {
    const memberCount = listed.find(({ id }) => id === role.id)?.memberCount ?? 0;
    return toRoleView({ ...role, memberCount });
  }

  private async settle<T>(written: Result<RoleWrite<T>, DatabaseUnavailable>, change: RoleChange) {
    const applied = andThen(written, (write) =>
      appliedOrRefused(write, change.roomId, change.conflictId)
    );
    return andThenAsync(applied, async ({ value, rolesVersion }) => {
      logChange(this.deps, change);
      await announceLine(this.deps, change.roomId, change.line);
      const listed = await publishRoles(this.deps, change.roomId, rolesVersion);
      return map(listed, (roles) => ({ value, roles, rolesVersion }));
    });
  }
}
