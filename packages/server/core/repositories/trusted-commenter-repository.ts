import type { NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface TrustedCommenter {
  channelId: string;
  userId: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface TrustedCommenterQuery {
  cursor: { createdAt: Date; userId: string } | null;
  limit: number;
}

export interface TrustedCommenterRepositoryPort {
  isTrusted(channelId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `false` when the user was already trusted; `audit` is recorded only when the list changed. */
  add(
    channelId: string,
    userId: string,
    createdBy: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `false` when the user was not trusted; `audit` is recorded only when the list changed. */
  remove(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    channelId: string,
    query: TrustedCommenterQuery
  ): Promise<Result<TrustedCommenter[], DatabaseUnavailable>>;
}
