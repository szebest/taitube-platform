import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { ApiToken, ApiTokenSummary, UserRole } from '@vp/domain';

/** A row whose prefix matched, with the role its user holds now, so a demotion counts at once. */
export interface ApiTokenCandidate {
  token: ApiToken;
  userRole: UserRole;
}

/**
 * Every read and write but the lookup by prefix is keyed by the user's id, so another user's token
 * is never reachable. Rows carry the secret's hash only; the secret itself is never stored.
 */
export interface ApiTokenRepositoryPort {
  create(token: ApiToken): Promise<Result<void, DatabaseUnavailable>>;
  /** Unrevoked tokens of the user that expire after `now`. */
  countActive(userId: string, now: Date): Promise<Result<number, DatabaseUnavailable>>;
  /** Unrevoked tokens of the user, newest first, with what each did on the UTC day of `now`. */
  listByUser(userId: string, now: Date): Promise<Result<ApiTokenSummary[], DatabaseUnavailable>>;
  /** Revoked or not; `null` when the user holds no such token. */
  findOwned(userId: string, id: string): Promise<Result<ApiToken | null, DatabaseUnavailable>>;
  /** `false` when the token was already revoked or is not the user's. */
  revoke(userId: string, id: string, at: Date): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Every row with the prefix, whatever its state: the caller compares the hash and decides. */
  findByPrefix(prefix: string): Promise<Result<ApiTokenCandidate[], DatabaseUnavailable>>;
  /** Sets `last_used_at` and adds one to the request count of the UTC day of `at`. */
  recordUse(id: string, at: Date): Promise<Result<void, DatabaseUnavailable>>;
}
