import type { NewOutboxInput } from './outbox-repository';

export type DlqStatus = 'PARKED' | 'REPLAYED' | 'DISCARDED';

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
  errorCode?: string | null;
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

export abstract class DlqRepository {
  abstract create(entry: NewDlqEntryInput): Promise<DlqEntryRecord>;
  abstract findById(id: string): Promise<DlqEntryRecord | null>;
  /** Newest first, `limit + 1` rows so the caller can detect a further page. */
  abstract list(options: ListDlqEntriesOptions): Promise<DlqEntryRecord[]>;
  abstract updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<DlqEntryRecord | null>;
}
