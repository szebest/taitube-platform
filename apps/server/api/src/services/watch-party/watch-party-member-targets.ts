import {
  effectivePermissions,
  parseMemberKey,
  type RoomRole,
  type WatchPartyMember,
} from '@vp/domain';
import {
  type DatabaseUnavailable,
  type WatchPartyNotFound,
  type WatchPartyRoleNotFound,
  watchPartyNotFound,
  watchPartyRoleNotFound,
} from '@vp/errors';
import type { WatchPartyMemberSubject } from '@vp/permissions';
import { andThen, andThenAsync, err, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { RoomContext, WatchPartyContextLoader } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';

export interface MemberTarget {
  readonly memberKey: string;
  readonly seat: WatchPartyMember;
  readonly subject: WatchPartyMemberSubject & { readonly memberKey: string };
}

export function actorKeyOf(context: RoomContext): Result<string, WatchPartyNotFound> {
  return context.memberKey === null
    ? err(watchPartyNotFound(context.room.id))
    : ok(context.memberKey);
}

export function roleOf(
  { roles }: RoomContext,
  roleId: string
): Result<RoomRole, WatchPartyRoleNotFound> {
  const role = roles.find(({ id }) => id === roleId);
  return role === undefined ? err(watchPartyRoleNotFound(roleId)) : ok(role);
}

export function memberKeyIn(roomId: string, memberKey: string): Result<string, WatchPartyNotFound> {
  return parseMemberKey(memberKey) === null ? err(watchPartyNotFound(roomId)) : ok(memberKey);
}

export async function resolveTarget(
  { repositories, now }: Pick<WatchPartyDeps, 'repositories' | 'now'>,
  context: RoomContext,
  memberKey: string,
  wanted: 'held' | 'any'
): Promise<Result<MemberTarget, WatchPartyNotFound | DatabaseUnavailable>> {
  const { room, roles, assignments } = context;
  const checked = memberKeyIn(room.id, memberKey);
  if (!checked.ok) return checked;
  const found = await repositories.watchPartyMembers.find(room.id, memberKey);
  return andThen(found, (seat) => {
    if (seat === null || (wanted === 'held' && seat.leftAt !== null))
      return err(watchPartyNotFound(room.id));
    const isOwner = memberKey === room.ownerKey;
    const { topPosition } = effectivePermissions({
      kind: seat.kind,
      isOwner,
      roles,
      assignments: assignments.filter((row) => row.memberKey === memberKey),
      now: now(),
    });
    return ok({ memberKey, seat, subject: { memberKey, kind: seat.kind, isOwner, topPosition } });
  });
}

export async function actingInRoom<T, E>(
  loader: WatchPartyContextLoader,
  roomId: string,
  caller: PartyCaller,
  act: (context: RoomContext, actorKey: string) => Promise<Result<T, E>>
): Promise<Result<T, E | WatchPartyNotFound | DatabaseUnavailable>> {
  const loaded = await loader.load(roomId, caller);
  return andThenAsync(loaded, (context) =>
    andThenAsync(actorKeyOf(context), (actorKey) => act(context, actorKey))
  );
}
