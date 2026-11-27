import type { Result } from '@kit/result';
import type {
  DataExport,
  DataExportKind,
  DataExportUsage,
  NewChannelAuditEntry,
  NewDataExport,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type CreateExportOutcome =
  | { type: 'created'; dataExport: DataExport }
  | { type: 'already-running' };

export interface DataExportListQuery {
  kinds: readonly DataExportKind[];
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}

export interface FinishedExport {
  objectKey: string;
  rowCount: number;
  expiresAt: Date;
}

/**
 * Every status write is a compare-and-set from the statuses `DATA_EXPORT_EDGES` allows, so a lost
 * race or a retried job answers `null` instead of failing. A request, a deletion and the job that
 * runs a request commit with their audit entry, outbox row or user event in the same transaction.
 */
export interface DataExportRepositoryPort {
  /** Whether one is queued or running, and how many were asked for since `since`. */
  usage(channelId: string, since: Date): Promise<Result<DataExportUsage, DatabaseUnavailable>>;
  /** `already-running` when another request of the channel won the race for its one slot. */
  create(
    dataExport: NewDataExport,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateExportOutcome, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>>;
  /** Newest first, of the given kinds, up to `limit + 1` rows. */
  list(
    channelId: string,
    query: DataExportListQuery
  ): Promise<Result<DataExport[], DatabaseUnavailable>>;
  /** The deleted row, or `null` when it was already gone. */
  remove(
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<DataExport | null, DatabaseUnavailable>>;
  start(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>>;
  /** Tells the requester `export.ready` on their stream with the move. */
  finish(
    id: string,
    finished: FinishedExport
  ): Promise<Result<DataExport | null, DatabaseUnavailable>>;
  /** Tells the requester `export.failed` on their stream with the move. */
  fail(id: string, reason: string): Promise<Result<DataExport | null, DatabaseUnavailable>>;
  /** Queued or running exports asked for before `cutoff`, whose job died without settling them. */
  listStale(cutoff: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>>;
  /** Ready exports whose file is past `expiresAt`, oldest first, at most `limit`. */
  listExpired(now: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>>;
  expire(ids: readonly string[]): Promise<Result<number, DatabaseUnavailable>>;
}
