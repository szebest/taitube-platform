import {
  admissionLimit,
  effectiveCapacity,
  effectivePermissions,
  type WatchPartyRoom,
} from '@vp/domain';
import type { WatchPartyJoinInput } from '@vp/domain-rules';
import type { CacheUnavailable } from '@vp/errors';
import { map, type Result } from '@vp/result';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';

export type JoinCapacity = WatchPartyJoinInput['capacity'];

export interface CapacityAsk {
  readonly room: Pick<WatchPartyRoom, 'id' | 'capacity'>;
  /** `null` while a guest has no key yet: nobody counts as already present. */
  readonly memberKey: string | null;
  readonly isOwner: boolean;
  readonly joinWhenFull: boolean;
}

export async function joinCapacity(
  { presence, config, now }: Pick<WatchPartyDeps, 'presence' | 'config' | 'now'>,
  { room, memberKey, isOwner, joinWhenFull }: CapacityAsk
): Promise<Result<JoinCapacity, CacheUnavailable>> {
  const present = await presence.members(room.id, now().getTime() - config.presence.staleAfterMs);
  return map(present, (members) => ({
    present: members.length,
    limit: admissionLimit(room.capacity, config.maxMembers, { isOwner, joinWhenFull }),
    shown: effectiveCapacity(room.capacity, config.maxMembers),
    alreadyPresent: memberKey !== null && members.some((member) => member.memberKey === memberKey),
  }));
}

/**
 * Whether the caller may be admitted above `capacity`, whether or not they hold a seat now: roles
 * they were assigned stay with them through a leave, so a returning member keeps the pass.
 */
export function holdsJoinWhenFull(context: RoomContext, now: Date): boolean {
  const { kind, isOwner, roles, assignments, memberKey } = context;
  if (kind === null) return false;
  const { permissions } = effectivePermissions({
    kind,
    isOwner,
    roles,
    assignments: assignments.filter((row) => row.memberKey === memberKey),
    now,
  });
  return permissions.includes('members.joinWhenFull');
}

export function isRoomMember({ seat, isOwner }: RoomContext): boolean {
  return seat !== null || isOwner;
}
