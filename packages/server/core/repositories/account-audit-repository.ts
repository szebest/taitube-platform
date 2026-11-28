import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { AccountAuditEntry, NewAccountAuditEntry } from '@vp/domain';

export interface AccountAuditQuery {
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}

/** Append-only, and every read is one user's own rows. */
export interface AccountAuditRepositoryPort {
  append(entry: NewAccountAuditEntry): Promise<Result<AccountAuditEntry, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    userId: string,
    query: AccountAuditQuery
  ): Promise<Result<AccountAuditEntry[], DatabaseUnavailable>>;
}
