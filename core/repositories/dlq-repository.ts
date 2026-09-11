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
  cursor?: string;
  limit?: number;
  status?: DlqStatus;
}

export interface ListDlqEntriesResult {
  items: DlqEntryRecord[];
  nextCursor: string | null;
}

import type { NewOutboxInput } from './outbox-repository.js';

export abstract class DlqRepository {
  abstract create(entry: NewDlqEntryInput): Promise<DlqEntryRecord>;
  abstract findById(id: string): Promise<DlqEntryRecord | null>;
  abstract list(options?: ListDlqEntriesOptions): Promise<ListDlqEntriesResult>;
  abstract updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<DlqEntryRecord | null>;
}
