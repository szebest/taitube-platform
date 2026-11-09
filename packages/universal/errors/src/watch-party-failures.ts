import { type ErrorCode, ErrorCodes } from './error-codes';
import type { Failure } from './failure';

type RoomFailure<C extends ErrorCode> = Failure<C, { roomId: string }>;

export type WatchPartyNotFound = RoomFailure<typeof ErrorCodes.WATCH_PARTY_NOT_FOUND>;
export type WatchPartyClosed = RoomFailure<typeof ErrorCodes.WATCH_PARTY_CLOSED>;
export type WatchPartyBanned = RoomFailure<typeof ErrorCodes.WATCH_PARTY_BANNED>;
export type WatchPartyGuestsOff = RoomFailure<typeof ErrorCodes.WATCH_PARTY_GUESTS_OFF>;
export type WatchPartyPasswordRequired = RoomFailure<
  typeof ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED
>;
export type WatchPartyPasswordInvalid = RoomFailure<typeof ErrorCodes.WATCH_PARTY_PASSWORD_INVALID>;
export type WatchPartyInviteInvalid = RoomFailure<typeof ErrorCodes.WATCH_PARTY_INVITE_INVALID>;
export type WatchPartyChatOff = RoomFailure<typeof ErrorCodes.WATCH_PARTY_CHAT_OFF>;
export type WatchPartyQueueFull = RoomFailure<typeof ErrorCodes.WATCH_PARTY_QUEUE_FULL>;
export type WatchPartyRoleLimit = RoomFailure<typeof ErrorCodes.WATCH_PARTY_ROLE_LIMIT>;

export type WatchPartyFull = Failure<
  typeof ErrorCodes.WATCH_PARTY_FULL,
  { roomId: string; present: number; capacity: number }
>;

export type WatchPartyPasswordLocked = Failure<
  typeof ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED,
  { retryAfterSeconds: number }
>;

export type WatchPartySlowMode = Failure<
  typeof ErrorCodes.WATCH_PARTY_SLOW_MODE,
  { retryAfterSeconds: number }
>;

export type WatchPartyLimitReached = Failure<
  typeof ErrorCodes.WATCH_PARTY_LIMIT_REACHED,
  { limit: number }
>;

/** Why a video cannot be in a room, for the log: the caller only learns that it cannot. */
export type NotShareableReason = 'missing' | 'not_ready' | 'live' | 'private' | 'unlisted';

export type WatchPartyVideoNotShareable = Failure<
  typeof ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
  { videoId: string; reason: NotShareableReason }
>;

/** The command's versions no longer match the room's: the sender re-applies on the current state. */
export type WatchPartyStateStale = Failure<
  typeof ErrorCodes.WATCH_PARTY_STATE_STALE,
  { playbackVersion: number; rolesVersion: number }
>;

export type WatchPartyPermissionMissing = Failure<
  typeof ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
  { permission: string }
>;

export type WatchPartyRoleEscalation = Failure<typeof ErrorCodes.WATCH_PARTY_ROLE_ESCALATION>;
export type WatchPartyRoleProtected = Failure<
  typeof ErrorCodes.WATCH_PARTY_ROLE_PROTECTED,
  { roleId: string }
>;
export type WatchPartyRoleNotFound = Failure<
  typeof ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND,
  { roleId: string }
>;

/** Unknown, spent or expired: a one-time socket token answers once, inside its time to live. */
export type WatchPartyTicketInvalid = Failure<typeof ErrorCodes.WATCH_PARTY_TICKET_INVALID>;
/** A party credential that resolves to nothing: expired, revoked or never issued. */
export type WatchPartyCredentialInvalid = Failure<typeof ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID>;

export function watchPartyNotFound(roomId: string): WatchPartyNotFound {
  return { code: ErrorCodes.WATCH_PARTY_NOT_FOUND, message: 'Watch party not found', roomId };
}

export function watchPartyClosed(roomId: string): WatchPartyClosed {
  return { code: ErrorCodes.WATCH_PARTY_CLOSED, message: 'Watch party has ended', roomId };
}

export function watchPartyBanned(roomId: string): WatchPartyBanned {
  return { code: ErrorCodes.WATCH_PARTY_BANNED, message: 'Banned from this watch party', roomId };
}

export function watchPartyGuestsOff(roomId: string): WatchPartyGuestsOff {
  return { code: ErrorCodes.WATCH_PARTY_GUESTS_OFF, message: 'Guests are not allowed', roomId };
}

export function watchPartyPasswordRequired(roomId: string): WatchPartyPasswordRequired {
  return {
    code: ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
    message: 'Password required',
    roomId,
  };
}

export function watchPartyPasswordInvalid(roomId: string): WatchPartyPasswordInvalid {
  return { code: ErrorCodes.WATCH_PARTY_PASSWORD_INVALID, message: 'Password is wrong', roomId };
}

export function watchPartyInviteInvalid(roomId: string): WatchPartyInviteInvalid {
  return { code: ErrorCodes.WATCH_PARTY_INVITE_INVALID, message: 'Invite is not valid', roomId };
}

export function watchPartyChatOff(roomId: string): WatchPartyChatOff {
  return { code: ErrorCodes.WATCH_PARTY_CHAT_OFF, message: 'Chat is off', roomId };
}

export function watchPartyQueueFull(roomId: string): WatchPartyQueueFull {
  return { code: ErrorCodes.WATCH_PARTY_QUEUE_FULL, message: 'Queue is full', roomId };
}

export function watchPartyRoleLimit(roomId: string): WatchPartyRoleLimit {
  return { code: ErrorCodes.WATCH_PARTY_ROLE_LIMIT, message: 'Too many roles', roomId };
}

export function watchPartyFull(roomId: string, present: number, capacity: number): WatchPartyFull {
  return {
    code: ErrorCodes.WATCH_PARTY_FULL,
    message: 'Watch party is full',
    roomId,
    present,
    capacity,
  };
}

export function watchPartyPasswordLocked(retryAfterSeconds: number): WatchPartyPasswordLocked {
  return {
    code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED,
    message: 'Too many wrong passwords',
    retryAfterSeconds,
  };
}

export function watchPartySlowMode(retryAfterSeconds: number): WatchPartySlowMode {
  return { code: ErrorCodes.WATCH_PARTY_SLOW_MODE, message: 'Sending too fast', retryAfterSeconds };
}

export function watchPartyLimitReached(limit: number): WatchPartyLimitReached {
  return {
    code: ErrorCodes.WATCH_PARTY_LIMIT_REACHED,
    message: 'Too many open watch parties',
    limit,
  };
}

export function watchPartyVideoNotShareable(
  videoId: string,
  reason: NotShareableReason
): WatchPartyVideoNotShareable {
  return {
    code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
    message: 'Video cannot be shared in this watch party',
    videoId,
    reason,
  };
}

export function watchPartyStateStale(
  playbackVersion: number,
  rolesVersion: number
): WatchPartyStateStale {
  return {
    code: ErrorCodes.WATCH_PARTY_STATE_STALE,
    message: 'Watch party state changed',
    playbackVersion,
    rolesVersion,
  };
}

export function watchPartyPermissionMissing(permission: string): WatchPartyPermissionMissing {
  return {
    code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
    message: `Missing the ${permission} permission`,
    permission,
  };
}

export function watchPartyRoleEscalation(): WatchPartyRoleEscalation {
  return {
    code: ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
    message: 'Not allowed at or above your own role',
  };
}

export function watchPartyRoleProtected(roleId: string): WatchPartyRoleProtected {
  return { code: ErrorCodes.WATCH_PARTY_ROLE_PROTECTED, message: 'Built-in role', roleId };
}

export function watchPartyRoleNotFound(roleId: string): WatchPartyRoleNotFound {
  return { code: ErrorCodes.WATCH_PARTY_ROLE_NOT_FOUND, message: 'Role not found', roleId };
}

export function watchPartyTicketInvalid(): WatchPartyTicketInvalid {
  return { code: ErrorCodes.WATCH_PARTY_TICKET_INVALID, message: 'Socket ticket is not valid' };
}

export function watchPartyCredentialInvalid(): WatchPartyCredentialInvalid {
  return {
    code: ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID,
    message: 'Party credential is not valid',
  };
}
