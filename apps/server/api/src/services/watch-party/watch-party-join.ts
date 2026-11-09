import type { HashingFailed } from '@vp/core/ports';
import {
  type MemberKey,
  memberKeyOf,
  type PartyPrincipal,
  type WatchPartyJoinPath,
} from '@vp/domain';
import {
  decideWatchPartyJoin,
  type JoinPassword,
  type WatchPartyJoinFailure,
  type WatchPartyJoinGrant,
  type WatchPartyJoinInput,
} from '@vp/domain-rules';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type WatchPartyInviteInvalid,
  type WatchPartyNotFound,
  type WatchPartyPasswordLocked,
  watchPartyNotFound,
} from '@vp/errors';
import { andThenAsync, err, isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import { holdsJoinWhenFull, isRoomMember, joinCapacity } from './watch-party-admission';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { claimGrant, findGrant, type Grant, joinGrantOf, settleGrant } from './watch-party-grants';
import { systemLineFor } from './watch-party-moderation-effects';
import { resolvePeople } from './watch-party-names';
import { checkPassword } from './watch-party-passwords';
import {
  ipHashOf,
  requirePrincipal,
  toNewSeat,
  type Unauthenticated,
} from './watch-party-principals';
import { heldRoleIds, type MembershipView, toMembershipView } from './watch-party-views';

export type JoinFailure =
  | Unauthenticated
  | WatchPartyJoinFailure
  | WatchPartyPasswordLocked
  | WatchPartyInviteInvalid
  | WatchPartyNotFound
  | HashingFailed
  | CacheUnavailable
  | DatabaseUnavailable;

export interface JoinWatchPartyInput {
  readonly password?: string;
  readonly invite?: string;
}

type JoinBody = JoinWatchPartyInput | null | undefined;

interface JoinState {
  readonly context: RoomContext;
  readonly principal: PartyPrincipal;
  readonly memberKey: MemberKey;
  readonly isMember: boolean;
  readonly grant: Grant;
  readonly banned: boolean;
  readonly capacity: WatchPartyJoinInput['capacity'];
}

async function stateOf(
  deps: WatchPartyDeps,
  context: RoomContext,
  principal: PartyPrincipal,
  body: JoinBody
): Promise<Result<JoinState, DatabaseUnavailable | CacheUnavailable>> {
  const { room, caller } = context;
  const memberKey = memberKeyOf(principal);
  const grant = await findGrant(deps, {
    roomId: room.id,
    userId: caller.user?.id ?? null,
    invite: body?.invite,
  });
  if (isErr(grant)) return grant;
  const banned = await deps.repositories.watchPartyMembers.isBanned(
    room.id,
    memberKey,
    ipHashOf(caller)
  );
  if (isErr(banned)) return banned;
  const capacity = await joinCapacity(deps, {
    room,
    memberKey,
    isOwner: context.isOwner,
    joinWhenFull: holdsJoinWhenFull(context, deps.now()),
  });
  if (isErr(capacity)) return capacity;

  return ok({
    context,
    principal,
    memberKey,
    isMember: isRoomMember(context),
    grant: grant.value,
    banned: banned.value,
    capacity: capacity.value,
  });
}

function joinInput(state: JoinState, password: JoinPassword): WatchPartyJoinInput {
  const { room } = state.context;
  return {
    room,
    kind: state.principal.kind,
    isMember: state.isMember,
    banned: state.banned,
    grant: joinGrantOf(state.grant),
    password,
    entry: 'link',
    capacity: state.capacity,
  };
}

/**
 * The join rules in their own order, hashing a password only once nothing earlier refuses: a
 * closed room, a ban or guests turned off answer before any scrypt is spent.
 */
async function decide(
  deps: WatchPartyDeps,
  state: JoinState,
  body: JoinBody
): Promise<
  Result<
    WatchPartyJoinGrant,
    WatchPartyJoinFailure | WatchPartyPasswordLocked | HashingFailed | CacheUnavailable
  >
> {
  const first = decideWatchPartyJoin(joinInput(state, 'none'));
  const { room, caller } = state.context;
  const { passwordHash } = room;
  const password = body?.password;
  const asksForPassword =
    !first.ok && first.error.code === ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED;
  if (!asksForPassword || password === undefined || passwordHash === null) return first;

  const verdict = await checkPassword(deps, {
    roomId: room.id,
    memberKey: state.memberKey,
    ip: caller.ip,
    passwordHash,
    password,
  });
  return andThenAsync(verdict, (checked) => decideWatchPartyJoin(joinInput(state, checked)));
}

function viaOf(granted: WatchPartyJoinGrant, state: JoinState): WatchPartyJoinPath {
  return granted.via ?? state.context.seat?.joinedVia ?? 'owner';
}

export async function joinRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  body: JoinBody
): Promise<Result<{ membership: MembershipView }, JoinFailure>> {
  const principal = requirePrincipal(caller, 'join a watch party');
  if (isErr(principal)) return principal;
  const loaded = await deps.context.load(roomId, caller);
  if (isErr(loaded)) return loaded;
  const state = await stateOf(deps, loaded.value, principal.value, body);
  if (isErr(state)) return state;

  const granted = await decide(deps, state.value, body);
  if (isErr(granted)) return granted;
  return seatCaller(deps, state.value, granted.value);
}

async function seatCaller(
  deps: WatchPartyDeps,
  state: JoinState,
  granted: WatchPartyJoinGrant
): Promise<Result<{ membership: MembershipView }, JoinFailure>> {
  const { context, principal, memberKey, grant } = state;
  const { room, caller } = context;
  const { via } = granted;
  const at = deps.now();

  const claimed = await claimGrant(deps, room.id, via === 'invite_link' ? grant : { type: 'none' });
  if (isErr(claimed)) return claimed;

  const rejoin = via === null && context.seat !== null;
  const seat = await deps.repositories.watchPartyMembers.join(
    toNewSeat({
      roomId: room.id,
      principal,
      joinedVia: viaOf(granted, state),
      joinedAt: at,
      ipHash: ipHashOf(caller),
    }),
    rejoin
      ? null
      : systemLineFor(deps, room, {
          event: 'joined',
          actorKey: memberKey,
          targetKey: null,
          detail: null,
        })
  );
  if (isErr(seat)) return seat;
  const settled = await settleGrant(deps, via === 'invite' ? grant : { type: 'none' });
  if (isErr(settled)) return settled;

  const after = deps.context.contextOf(
    room,
    context.roles,
    context.assignments,
    seat.value,
    caller
  );
  const people = await resolvePeople(
    deps.repositories.channels,
    [memberKey],
    new Map([[memberKey, seat.value]])
  );
  if (isErr(people)) return people;
  return ok({
    membership: toMembershipView(
      seat.value,
      people.value(memberKey).name,
      heldRoleIds(context.assignments, memberKey, at),
      after.effective
    ),
  });
}

export async function leaveRoom(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller
): Promise<
  Result<void, Unauthenticated | WatchPartyNotFound | CacheUnavailable | DatabaseUnavailable>
> {
  const principal = requirePrincipal(caller, 'leave a watch party');
  if (isErr(principal)) return principal;
  const loaded = await deps.context.load(roomId, caller);
  if (isErr(loaded)) return loaded;
  const { room, seat, memberKey } = loaded.value;
  if (seat === null || memberKey === null) return err(watchPartyNotFound(roomId));

  const left = await deps.repositories.watchPartyMembers.leave(
    roomId,
    memberKey,
    systemLineFor(deps, room, {
      event: 'left',
      actorKey: memberKey,
      targetKey: null,
      detail: null,
    }),
    deps.now()
  );
  if (isErr(left)) return left;
  return deps.presence.leave(roomId, memberKey);
}
