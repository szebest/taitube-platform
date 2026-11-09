import type { PartyPrincipal } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Role } from '@vp/permissions';
import type { Result } from '@vp/result';

/** Who a one-time room socket token was issued to, and for which room. */
export interface WatchPartyTicketGrant {
  readonly roomId: string;
  readonly principal: PartyPrincipal;
  /** The account's platform role, for an account; staff hold moderation in every room. */
  readonly role: Role | null;
}

/** The per-key budgets every pod counts against, so nobody beats a limit by spreading over pods. */
export type WatchPartyBudget =
  | 'create'
  | 'command'
  | 'reaction'
  | 'request'
  | 'chat'
  | 'invite'
  | 'guest-credential'
  | 'guest-join'
  | 'password';

export interface BudgetRule {
  readonly limit: number;
  readonly windowSeconds: number;
}

export type GateAdmission =
  | { readonly type: 'admitted' }
  | { readonly type: 'refused'; readonly retryAfterSeconds: number };

/**
 * A room's shared short-lived state: the one-time tokens a socket opens with, the budgets, slow
 * mode, the roles version every pod re-reads before a chat line, and the skip votes per item.
 */
export interface WatchPartyGatePort {
  issueTicket(
    ticket: string,
    grant: WatchPartyTicketGrant,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>>;
  /** Consumes the token: a second redeem of the same one answers `ok(null)`. */
  redeemTicket(ticket: string): Promise<Result<WatchPartyTicketGrant | null, CacheUnavailable>>;
  /** Counts this attempt, refused ones included, so hammering buys nothing. */
  consume(
    budget: WatchPartyBudget,
    scope: string,
    rule: BudgetRule
  ): Promise<Result<GateAdmission, CacheUnavailable>>;
  /** Gives one counted attempt back, never below nothing spent: a password that proved right. */
  release(budget: WatchPartyBudget, scope: string): Promise<Result<void, CacheUnavailable>>;
  reset(budget: WatchPartyBudget, scope: string): Promise<Result<void, CacheUnavailable>>;
  /** Claims the member's next line in `seconds`; refused while the last one's wait runs. */
  slowMode(
    roomId: string,
    memberKey: string,
    seconds: number
  ): Promise<Result<GateAdmission, CacheUnavailable>>;
  setRolesVersion(roomId: string, rolesVersion: number): Promise<Result<void, CacheUnavailable>>;
  /** `null` when no pod has written it since the cache was emptied: read the room instead. */
  rolesVersion(roomId: string): Promise<Result<number | null, CacheUnavailable>>;
  /** Records one vote per member per item and answers the item's tally. */
  voteSkip(
    roomId: string,
    itemId: string,
    memberKey: string
  ): Promise<Result<number, CacheUnavailable>>;
  clearSkipVotes(roomId: string, itemId: string): Promise<Result<void, CacheUnavailable>>;
}
