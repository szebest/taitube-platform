import type { WatchPartyPreviewView } from '@vp/api-contracts';
import {
  type MemberKind,
  type RosterPreview,
  type RosterPreviewMember,
  toRosterPreview,
  type WatchPartyJoinState,
  type WatchPartyMember,
  type WatchPartyPreviewAction,
  type WatchPartyRoom,
} from '@vp/domain';
import { decideWatchPartyJoin, type WatchPartyJoinFailure } from '@vp/domain-rules';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type WatchPartyNotFound,
  watchPartyNotFound,
} from '@vp/errors';
import { canReadWatchParty } from '@vp/permissions';
import { assertNever, err, isErr, ok, type Result } from '@vp/result';
import { holdsJoinWhenFull, isRoomMember, joinCapacity } from './watch-party-admission';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { findGrant, type Grant, joinGrantOf } from './watch-party-grants';
import { resolvePeople } from './watch-party-names';
import { ipHashOf } from './watch-party-principals';
import { presentRoom } from './watch-party-room-views';
import { heldRoleIds } from './watch-party-views';

export type PreviewFailure = WatchPartyNotFound | DatabaseUnavailable | CacheUnavailable;

function joinStateOf(failure: WatchPartyJoinFailure): WatchPartyJoinState {
  switch (failure.code) {
    case ErrorCodes.WATCH_PARTY_CLOSED:
      return 'closed';
    case ErrorCodes.WATCH_PARTY_BANNED:
      return 'banned';
    case ErrorCodes.WATCH_PARTY_GUESTS_OFF:
      return 'guests_off';
    case ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED:
    case ErrorCodes.WATCH_PARTY_PASSWORD_INVALID:
      return 'password';
    case ErrorCodes.WATCH_PARTY_FULL:
      return 'full';
    case ErrorCodes.WATCH_PARTY_NOT_FOUND:
    case ErrorCodes.WATCH_PARTY_INVITE_INVALID:
      return 'closed';
    default:
      return assertNever(failure, 'WatchPartyJoinFailure');
  }
}

export async function rosterPreviewOf(
  { repositories, presence, config, now }: WatchPartyDeps,
  room: Pick<WatchPartyRoom, 'id' | 'visibility'>
): Promise<Result<RosterPreview, DatabaseUnavailable | CacheUnavailable>> {
  const present = await presence.members(room.id, now().getTime() - config.presence.staleAfterMs);
  if (isErr(present)) return present;
  const seated = await repositories.watchPartyMembers.listSeated(room.id);
  if (isErr(seated)) return seated;

  const seats = new Map(seated.value.map((seat) => [seat.memberKey, seat]));
  const watching = present.value.flatMap(({ memberKey }) => seats.get(memberKey) ?? []);
  const people = await resolvePeople(repositories.channels, [...seats.keys()], seats);
  if (isErr(people)) return people;
  const userIds = watching.flatMap(({ userId }) => userId ?? []);
  const preferences =
    userIds.length === 0 ? ok([]) : await repositories.userPreferences.findMany(userIds);
  if (isErr(preferences)) return preferences;

  const shown = new Map(
    preferences.value.map(({ userId, privacy }) => [userId, privacy?.showInParties])
  );
  const showsFace = ({ userId }: WatchPartyMember) =>
    (userId === null ? undefined : shown.get(userId)) ?? DEFAULT_PREFERENCES.privacy.showInParties;
  const members: RosterPreviewMember[] = watching.map((seat) => {
    const { name, avatarUrl } = people.value(seat.memberKey);
    return { kind: seat.kind, name, avatarUrl, showInParties: showsFace(seat) };
  });
  return ok(toRosterPreview(members, room.visibility, 'app'));
}

export interface RoomAccess {
  readonly grant: Grant;
  readonly isMember: boolean;
}

/** A private room is invisible to anyone without a seat or a grant: the same answer as no room. */
export async function roomAccessOf(
  deps: WatchPartyDeps,
  context: RoomContext,
  invite: string | undefined
): Promise<Result<RoomAccess, PreviewFailure>> {
  const { room, caller } = context;
  const isMember = isRoomMember(context);
  const grant = await findGrant(deps, {
    roomId: room.id,
    userId: caller.user?.id ?? null,
    invite,
  });
  if (isErr(grant)) return grant;

  const hasGrant = grant.value.type === 'invite' || grant.value.type === 'link';
  return canReadWatchParty(caller.user, { visibility: room.visibility, isMember, hasGrant })
    ? ok({ grant: grant.value, isMember })
    : err(watchPartyNotFound(room.id));
}

async function joinStateFor(
  deps: WatchPartyDeps,
  context: RoomContext,
  { grant, isMember }: RoomAccess
): Promise<Result<WatchPartyJoinState, DatabaseUnavailable | CacheUnavailable>> {
  const { room, caller, memberKey } = context;
  const kind: MemberKind = context.kind ?? 'guest';
  const banned =
    memberKey === null
      ? ok(false)
      : await deps.repositories.watchPartyMembers.isBanned(room.id, memberKey, ipHashOf(caller));
  if (isErr(banned)) return banned;
  const capacity = await joinCapacity(deps, {
    room,
    memberKey,
    isOwner: context.isOwner,
    joinWhenFull: holdsJoinWhenFull(context, deps.now()),
  });
  if (isErr(capacity)) return capacity;

  const decided = decideWatchPartyJoin({
    room,
    kind,
    isMember,
    banned: banned.value,
    grant: joinGrantOf(grant),
    password: 'none',
    entry: 'link',
    capacity: { ...capacity.value, alreadyPresent: capacity.value.alreadyPresent || isMember },
  });
  if (isErr(decided)) return ok(joinStateOf(decided.error));
  return ok(decided.value.via === null ? 'member' : 'yes');
}

function actionsFor(
  { caller, room }: RoomContext,
  guestsEnabled: boolean
): WatchPartyPreviewAction[] {
  const canGuest =
    room.allowGuests && guestsEnabled && caller.user === null && caller.party === null;
  return [
    ...(canGuest ? (['guest'] as const) : []),
    ...(caller.user === null ? (['sign_in'] as const) : []),
  ];
}

export async function previewRoom(
  deps: WatchPartyDeps,
  context: RoomContext,
  invite: string | undefined
): Promise<Result<WatchPartyPreviewView, PreviewFailure>> {
  const access = await roomAccessOf(deps, context, invite);
  if (isErr(access)) return access;
  const { room } = context;

  const view = await presentRoom(deps, room);
  if (isErr(view)) return view;
  const roster = await rosterPreviewOf(deps, room);
  if (isErr(roster)) return roster;
  const canJoin = await joinStateFor(deps, context, access.value);
  if (isErr(canJoin)) return canJoin;

  return ok({
    ...view.value,
    features: { voice: false },
    roster: { ...roster.value, faces: [...roster.value.faces] },
    viewer: {
      memberKey: context.memberKey,
      permissions: [...context.effective.permissions],
      roleIds:
        context.seat === null
          ? []
          : heldRoleIds(context.assignments, context.seat.memberKey, deps.now()),
      canJoin: canJoin.value,
      actions: actionsFor(context, deps.config.guestSalt !== undefined),
    },
  });
}
