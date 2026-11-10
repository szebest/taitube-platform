import type { NewWatchPartyMember } from '@vp/core/repositories';
import { memberKeyOf, type PartyPrincipal, type WatchPartyJoinPath } from '@vp/domain';
import type { AuthorizationFailure } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { assertNever, err, ok, type Result } from '@vp/result';
import { type PartyCaller, principalOf } from './party-caller';

export type Unauthenticated = Extract<
  AuthorizationFailure,
  { readonly code: typeof ErrorCodes.UNAUTHORIZED }
>;

export function requirePrincipal(
  caller: PartyCaller,
  action: string
): Result<PartyPrincipal, Unauthenticated> {
  const principal = principalOf(caller);
  if (principal !== null) return ok(principal);
  return err({
    code: ErrorCodes.UNAUTHORIZED,
    message: `Sign in or join as a guest to ${action}`,
    action,
    subject: 'WatchParty',
  });
}

/** Only a guest is held to a ban by address; the account behind a session is held by its key. */
export function ipHashOf(caller: PartyCaller): string | null {
  return caller.user === null ? (caller.party?.ipHash ?? null) : null;
}

export interface NewSeat {
  readonly roomId: string;
  readonly principal: PartyPrincipal;
  readonly joinedVia: WatchPartyJoinPath;
  readonly joinedAt: Date;
  readonly ipHash: string | null;
}

export function toNewSeat({
  roomId,
  principal,
  joinedVia,
  joinedAt,
  ipHash,
}: NewSeat): NewWatchPartyMember {
  const base = { roomId, memberKey: memberKeyOf(principal), joinedVia, joinedAt, ipHash };
  switch (principal.kind) {
    case 'user':
      return {
        ...base,
        kind: 'user',
        userId: principal.userId,
        discordUserId: null,
        displayName: null,
        avatarUrl: null,
      };
    case 'discord':
      return {
        ...base,
        kind: 'discord',
        userId: null,
        discordUserId: principal.discordUserId,
        displayName: principal.name,
        avatarUrl: principal.avatarUrl,
      };
    case 'guest':
      return {
        ...base,
        kind: 'guest',
        userId: null,
        discordUserId: null,
        displayName: principal.name,
        avatarUrl: null,
      };
    default:
      return assertNever(principal, 'PartyPrincipal');
  }
}
