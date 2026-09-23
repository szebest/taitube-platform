import {
  type DlqEntryRecord,
  DlqRepository,
  type DlqStatus,
  type ListDlqEntriesOptions,
  type NewDlqEntryInput,
  type NewOutboxInput,
  type OutboxRepository,
} from '@vp/core/repositories';

import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export class InMemoryDlqRepository extends DlqRepository {
  private readonly entriesMap: Map<string, DlqEntryRecord>;
  private outboxRepo?: OutboxRepository;

  constructor(
    entriesMap?: Map<string, DlqEntryRecord>,
    options?: { outboxRepo?: OutboxRepository }
  ) {
    super();
    this.entriesMap = entriesMap ?? new Map();
    this.outboxRepo = options?.outboxRepo;
  }

  clear(): void {
    this.entriesMap.clear();
  }

  async create(entry: NewDlqEntryInput): Promise<Result<DlqEntryRecord, DatabaseUnavailable>> {
    for (const existing of this.entriesMap.values()) {
      if (
        existing.queue === entry.queue &&
        existing.jobId === entry.jobId &&
        existing.attemptsMade === entry.attemptsMade
      ) {
        existing.errorCode = entry.errorCode ?? existing.errorCode;
        existing.errorMessage = entry.errorMessage ?? existing.errorMessage;
        existing.stack = entry.stack ?? existing.stack;
        existing.workerId = entry.workerId ?? existing.workerId;
        return ok({ ...existing });
      }
    }

    const record: DlqEntryRecord = {
      id: entry.id ?? uuidv7(),
      queue: entry.queue,
      jobId: entry.jobId,
      videoId: entry.videoId ?? null,
      payload: entry.payload,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      stack: entry.stack ?? null,
      attemptsMade: entry.attemptsMade,
      workerId: entry.workerId ?? null,
      status: entry.status ?? 'PARKED',
      createdAt: new Date(),
      replayedAt: null,
    };

    this.entriesMap.set(record.id, record);
    return ok({ ...record });
  }

  async findById(id: string): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>> {
    const entry = this.entriesMap.get(id);
    return ok(entry ? { ...entry } : null);
  }

  async list(
    options: ListDlqEntriesOptions
  ): Promise<Result<DlqEntryRecord[], DatabaseUnavailable>> {
    const { cursor, limit, status } = options;
    const keyset = cursor && { sort: cursor.createdAt, tie: cursor.id };

    return ok(
      Array.from(this.entriesMap.values())
        .filter(
          (entry) =>
            (!status || entry.status === status) &&
            isKeysetBefore({ sort: entry.createdAt, tie: entry.id }, keyset)
        )
        .sort((a, b) =>
          byKeysetDesc({ sort: a.createdAt, tie: a.id }, { sort: b.createdAt, tie: b.id })
        )
        .slice(0, limit + 1)
        .map((entry) => ({ ...entry }))
    );
  }

  setOutboxRepo(repo: OutboxRepository): void {
    this.outboxRepo = repo;
  }

  async updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<Result<DlqEntryRecord | null, DatabaseUnavailable>> {
    const entry = this.entriesMap.get(id);
    if (!entry) return ok(null);

    entry.status = status;
    if (patch?.replayedAt !== undefined) {
      entry.replayedAt = patch.replayedAt;
    }

    if (outbox && this.outboxRepo) {
      await this.outboxRepo.enqueue(outbox);
    }

    return ok({ ...entry });
  }
}
