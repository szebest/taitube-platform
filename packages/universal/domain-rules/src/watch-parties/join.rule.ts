import {
  hasSpace,
  type MemberKind,
  type WatchPartyJoinPath,
  type WatchPartyRoom,
} from '@vp/domain';
import {
  type WatchPartyBanned,
  type WatchPartyClosed,
  type WatchPartyFull,
  type WatchPartyGuestsOff,
  type WatchPartyInviteInvalid,
  type WatchPartyNotFound,
  type WatchPartyPasswordInvalid,
  type WatchPartyPasswordRequired,
  watchPartyBanned,
  watchPartyClosed,
  watchPartyFull,
  watchPartyGuestsOff,
  watchPartyInviteInvalid,
  watchPartyNotFound,
  watchPartyPasswordInvalid,
  watchPartyPasswordRequired,
} from '@vp/errors';
import { err, ok, type Result } from '@vp/result';

/** What the caller presented beside the link: a grant already checked against its row, or one that failed. */
export type JoinGrant = 'invite' | 'invite_link' | 'invalid' | null;

export type JoinPassword = 'none' | 'valid' | 'invalid';

export interface WatchPartyJoinInput {
  readonly room: Pick<
    WatchPartyRoom,
    'id' | 'status' | 'visibility' | 'allowGuests' | 'passwordHash'
  >;
  readonly kind: MemberKind;
  readonly isMember: boolean;
  /** By member key, or for a guest by the IP hash too. */
  readonly banned: boolean;
  readonly grant: JoinGrant;
  /** Read only when `joinNeedsPassword` says so; the caller hashes nothing otherwise. */
  readonly password: JoinPassword;
  readonly entry: 'link' | 'discovery';
  readonly capacity: {
    readonly present: number;
    /** From `admissionLimit`: `null` admits at any count. */
    readonly limit: number | null;
    /** What "12 / 12" shows. */
    readonly shown: number;
    /** Already holds a socket: a rejoin takes no new spot. */
    readonly alreadyPresent: boolean;
  };
}

export type WatchPartyJoinFailure =
  | WatchPartyClosed
  | WatchPartyBanned
  | WatchPartyGuestsOff
  | WatchPartyNotFound
  | WatchPartyInviteInvalid
  | WatchPartyPasswordRequired
  | WatchPartyPasswordInvalid
  | WatchPartyFull;

/** `via` is how the seat was gained; `null` when the caller already held one. */
export interface WatchPartyJoinGrant {
  readonly via: WatchPartyJoinPath | null;
}

type AccessInput = Pick<WatchPartyJoinInput, 'room' | 'isMember' | 'grant'>;

function hasAccess({ isMember, grant }: AccessInput): boolean {
  return isMember || grant === 'invite' || grant === 'invite_link';
}

/** A membership, an invite and an invite link each skip the password: an explicit grant is the stronger credential. */
/** @internal */
export function joinNeedsPassword(input: AccessInput): boolean {
  return input.room.passwordHash !== null && !hasAccess(input);
}

function decideAccess(
  input: WatchPartyJoinInput
): Result<WatchPartyJoinGrant, WatchPartyJoinFailure> {
  const { room, isMember, grant, password, entry } = input;
  if (isMember) return ok({ via: null });
  if (grant === 'invite' || grant === 'invite_link') return ok({ via: grant });
  if (grant === 'invalid' && (room.visibility === 'private' || room.passwordHash !== null)) {
    return err(watchPartyInviteInvalid(room.id));
  }
  if (room.visibility === 'private') return err(watchPartyNotFound(room.id));
  if (!joinNeedsPassword(input)) return ok({ via: entry });
  switch (password) {
    case 'none':
      return err(watchPartyPasswordRequired(room.id));
    case 'invalid':
      return err(watchPartyPasswordInvalid(room.id));
    case 'valid':
      return ok({ via: 'password' });
  }
}

/**
 * Section 4's order: closed, banned, guests off, access (a private room answers not found to anyone
 * without a grant), then capacity, which no invite bypasses.
 */
export function decideWatchPartyJoin(
  input: WatchPartyJoinInput
): Result<WatchPartyJoinGrant, WatchPartyJoinFailure> {
  const { room, kind, banned, capacity } = input;
  if (room.status === 'closed') return err(watchPartyClosed(room.id));
  if (banned) return err(watchPartyBanned(room.id));
  if (kind === 'guest' && !room.allowGuests) return err(watchPartyGuestsOff(room.id));

  const access = decideAccess(input);
  if (!access.ok) return access;
  if (!capacity.alreadyPresent && !hasSpace(capacity.present, capacity.limit)) {
    return err(watchPartyFull(room.id, capacity.present, capacity.shown));
  }
  return access;
}
