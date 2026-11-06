import type { CacheUnavailable } from '@vp/errors';
import type { Role } from '@vp/permissions';
import type { Result } from '@vp/result';

/** Who a one-time chat token was issued to, and for which stream. */
export interface LiveChatTicketGrant {
  userId: string;
  role: Role;
  liveStreamId: string;
}

export interface LiveChatAdmissionRules {
  /** Seconds between two lines; `0` is off. */
  slowModeSeconds: number;
  /** At most `messages` lines in any `windowSeconds`, slow mode or not. */
  burst: { messages: number; windowSeconds: number };
}

export type LiveChatAdmission =
  | { type: 'admitted' }
  | { type: 'refused'; retryAfterSeconds: number };

/**
 * The chat's shared short-lived state: the one-time tokens a socket opens with, and the per-user
 * budgets every pod counts against, so a sender cannot spread lines over pods to beat a limit.
 */
export interface LiveChatGatePort {
  issueTicket(
    ticket: string,
    grant: LiveChatTicketGrant,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>>;
  /** Consumes the token: a second redeem of the same one answers `ok(null)`. */
  redeemTicket(ticket: string): Promise<Result<LiveChatTicketGrant | null, CacheUnavailable>>;
  admit(
    liveStreamId: string,
    userId: string,
    rules: LiveChatAdmissionRules
  ): Promise<Result<LiveChatAdmission, CacheUnavailable>>;
}
