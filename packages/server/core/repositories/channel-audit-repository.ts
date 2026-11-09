import type { ChannelAuditAction, ChannelAuditEntry, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ChannelAuditQuery {
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
  actorUserId?: string;
  action?: ChannelAuditAction;
}

/** Append-only: nothing updates or deletes a row but the retention purge. */
export interface ChannelAuditRepositoryPort {
  append(entry: NewChannelAuditEntry): Promise<Result<ChannelAuditEntry, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    channelId: string,
    query: ChannelAuditQuery
  ): Promise<Result<ChannelAuditEntry[], DatabaseUnavailable>>;
  /** Housekeeping: drops every channel's rows written before `cutoff`; answers how many. */
  purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}
