import type { NewSystemLine, RoleWrite } from '@vp/core/repositories';
import { type BuiltInRoleKey, ROLE_EXPIRY_MS, type RoleExpiry, type RoomRole } from '@vp/domain';
import { decideRoleAssign, decideRoleRevoke } from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  type WatchPartyRoleNotFound,
  watchPartyRoleNotFound,
} from '@vp/errors';
import { andThen, andThenAsync, err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import type { PartyCaller } from './party-caller';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { actingInRoom, resolveTarget, roleOf } from './watch-party-member-targets';
import {
  afterCommit,
  announceLine,
  announceMemberRoles,
  appliedOrRefused,
  logChange,
  systemLineFor,
} from './watch-party-moderation-effects';

const MUTE_ROLE_KEYS: readonly BuiltInRoleKey[] = ['chat_muted', 'voice_muted'];

export interface RoleOnMember {
  readonly roomId: string;
  readonly caller: PartyCaller;
  readonly memberKey: string;
  readonly roleId: string;
}

function heldBy(
  { assignments }: RoomContext,
  memberKey: string,
  roleId: string
): Result<true, WatchPartyRoleNotFound> {
  const held = assignments.some((row) => row.memberKey === memberKey && row.roleId === roleId);
  return held ? ok(true) : err(watchPartyRoleNotFound(roleId));
}

function expiryOf(
  role: RoomRole,
  expiresIn: RoleExpiry | undefined,
  now: Date
): Result<Date | null, InvalidField> {
  if (expiresIn === undefined) return ok(null);
  if (role.key === null || !MUTE_ROLE_KEYS.includes(role.key)) {
    return err(
      invalidField('expiresIn', 'expiresIn applies to Chat muted and Voice muted only', {})
    );
  }
  const ms = ROLE_EXPIRY_MS[expiresIn];
  return ok(ms === null ? null : new Date(now.getTime() + ms));
}

export function assignMemberRole(
  deps: WatchPartyDeps,
  input: RoleOnMember & { readonly expiresIn: RoleExpiry | undefined }
) {
  const { roomId, caller, memberKey, roleId, expiresIn } = input;
  return actingInRoom(deps.context, roomId, caller, async (context, actorKey) => {
    const resolved = await resolveTarget(deps, context, memberKey, 'held');
    return andThenAsync(resolved, ({ subject }) =>
      andThenAsync(roleOf(context, roleId), (role) => {
        const decided = decideRoleAssign({
          ability: context.ability,
          actorKey,
          target: subject,
          role,
        });
        return andThenAsync(decided, () =>
          andThenAsync(expiryOf(role, expiresIn, deps.now()), async (expiresAt) => {
            const at = deps.now();
            const line = {
              event: 'role_assigned',
              actorKey,
              targetKey: memberKey,
              detail: role.name,
            } as const;
            const stored = systemLineFor(deps, context.room, line);
            const written = await deps.repositories.watchPartyRoles.assign(
              { roomId, memberKey, roleId, grantedBy: actorKey, expiresAt, createdAt: at },
              { line: stored, at }
            );
            return changed(
              deps,
              { roomId, actorKey, memberKey, action: 'role.assign', line: stored },
              written
            );
          })
        );
      })
    );
  });
}

export function revokeMemberRole(deps: WatchPartyDeps, input: RoleOnMember) {
  const { roomId, caller, memberKey, roleId } = input;
  return actingInRoom(deps.context, roomId, caller, async (context, actorKey) => {
    const resolved = await resolveTarget(deps, context, memberKey, 'held');
    return andThenAsync(resolved, ({ subject }) =>
      andThenAsync(roleOf(context, roleId), (role) => {
        const decided = decideRoleRevoke({
          ability: context.ability,
          actorKey,
          target: subject,
          role,
        });
        return andThenAsync(decided, () =>
          andThenAsync(heldBy(context, memberKey, roleId), async () => {
            const line = {
              event: 'role_revoked',
              actorKey,
              targetKey: memberKey,
              detail: role.name,
            } as const;
            const stored = systemLineFor(deps, context.room, line);
            const written = await deps.repositories.watchPartyRoles.revoke(
              roomId,
              memberKey,
              roleId,
              {
                line: stored,
                at: deps.now(),
              }
            );
            return changed(
              deps,
              { roomId, actorKey, memberKey, action: 'role.revoke', line: stored },
              written
            );
          })
        );
      })
    );
  });
}

async function changed(
  deps: WatchPartyDeps,
  change: {
    roomId: string;
    actorKey: string;
    memberKey: string;
    action: string;
    line: NewSystemLine;
  },
  written: Result<RoleWrite<unknown>, DatabaseUnavailable>
) {
  const { roomId, actorKey, memberKey, action, line } = change;
  const applied = andThen(written, (write) => appliedOrRefused(write, roomId, roomId));
  return afterCommit(applied, async ({ rolesVersion }) => {
    logChange(deps, { roomId, actorKey, action, targetKey: memberKey });
    await announceLine(deps, roomId, line);
    await announceMemberRoles(deps, roomId, memberKey, rolesVersion);
  });
}
