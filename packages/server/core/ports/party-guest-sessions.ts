import type { PartyPrincipal } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/** A guest's or a Discord member's party credential: no account, so no app session. */
export interface PartyGuestSession {
  readonly principal: Exclude<PartyPrincipal, { kind: 'user' }>;
  /** A guest's IP hash, kept for a ban; `null` for a Discord member. */
  readonly ipHash: string | null;
}

/**
 * Party credentials by the SHA-256 of their token, never the token itself, each on a sliding
 * time to live. 140 issues guest ones; the Discord integration issues its own through this port.
 */
export interface PartyGuestSessionsPort {
  issue(
    credential: string,
    session: PartyGuestSession,
    ttlSeconds: number
  ): Promise<Result<void, CacheUnavailable>>;
  /** Slides the time to live forward on every hit; `ok(null)` for an unknown or expired one. */
  resolve(
    credential: string,
    ttlSeconds: number
  ): Promise<Result<PartyGuestSession | null, CacheUnavailable>>;
  revoke(credential: string): Promise<Result<void, CacheUnavailable>>;
}
