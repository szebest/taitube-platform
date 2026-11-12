import type { DlqStatus } from '@vp/domain';
import type { DatabaseUnavailable, ErrorCode } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewOutboxInput } from './outbox-repository';

export interface DlqEntryRecord {
  id: string;
  queue: string;
  jobId: string;
  videoId: string | null;
  payload: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  stack: string | null;
  attemptsMade: number;
  workerId: string | null;
  status: DlqStatus;
  createdAt: Date;
  replayedAt: Date | null;
}

export interface NewDlqEntryInput {
  id: string;
  queue: string;
  jobId: string;
  videoId?: string | null;
  payload: unknown;
  errorCode?: ErrorCode | null;
  errorMessage?: string | null;
  stack?: string | null;
  attemptsMade: number;
  workerId?: string | null;
  status?: DlqStatus;
}

export interface ListDlqEntriesOptions {
  cursor?: { createdAt: Date; id: string } | null;
  limit: number;
  status?: DlqStatus;
}

/** A compare-and-set: the entry moves only while its status is one of `from`. */
export interface DlqTransition {
  id: string;
  from: readonly DlqStatus[];
  to: DlqStatus;
  replayedAt?: Date;
  outbox?: NewOutboxInput;
}

export abstract class DlqRepository {
  abstract create(entry: NewDlqEntryInput): Promise<Result<DlqEntryRecord, DatabaseUnavailable>>;
  abstract findById(id: string): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>>;
  /** Newest first, `limit + 1` rows so the caller can detect a further page. */
  abstract list(
    options: ListDlqEntriesOptions
  ): Promise<Result<DlqEntryRecord[], DatabaseUnavailable>>;
  /** `null` for an unknown entry or one no longer in `from`; the outbox row is written only on a move. */
  abstract transition(
    options: DlqTransition
  ): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>>;
}
