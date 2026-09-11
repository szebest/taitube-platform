import {
  type DlqEntryRecord,
  DlqRepository,
  type DlqStatus,
  type ListDlqEntriesOptions,
  type ListDlqEntriesResult,
  type NewDlqEntryInput,
  type NewOutboxInput,
  type OutboxRepository,
} from '@vp/core/ports';

import { uuidv7 } from 'uuidv7';

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), id })).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed.c && parsed.id) {
      return { createdAt: new Date(parsed.c), id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

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

  async create(entry: NewDlqEntryInput): Promise<DlqEntryRecord> {
    // Unique check on (queue, jobId, attemptsMade)
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
        return { ...existing };
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
    return { ...record };
  }

  async findById(id: string): Promise<DlqEntryRecord | null> {
    const entry = this.entriesMap.get(id);
    return entry ? { ...entry } : null;
  }

  async list(options?: ListDlqEntriesOptions): Promise<ListDlqEntriesResult> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    let items = Array.from(this.entriesMap.values());

    if (options?.status) {
      items = items.filter((e) => e.status === options.status);
    }

    // Sort descending by createdAt, then id
    items.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    if (options?.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        items = items.filter((e) => {
          const itemTime = e.createdAt.getTime();
          const cursorTime = decoded.createdAt.getTime();
          if (itemTime < cursorTime) return true;
          if (itemTime === cursorTime && e.id.localeCompare(decoded.id) < 0) return true;
          return false;
        });
      }
    }

    const hasMore = items.length > limit;
    const pagedItems = (hasMore ? items.slice(0, limit) : items).map((e) => ({ ...e }));
    const lastItem =
      hasMore && pagedItems.length > 0 ? pagedItems[pagedItems.length - 1] : undefined;
    const nextCursor = lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

    return { items: pagedItems, nextCursor };
  }

  setOutboxRepo(repo: OutboxRepository): void {
    this.outboxRepo = repo;
  }

  async updateStatus(
    id: string,
    status: DlqStatus,
    patch?: { replayedAt?: Date },
    outbox?: NewOutboxInput
  ): Promise<DlqEntryRecord | null> {
    const entry = this.entriesMap.get(id);
    if (!entry) return null;

    entry.status = status;
    if (patch?.replayedAt !== undefined) {
      entry.replayedAt = patch.replayedAt;
    }

    if (outbox && this.outboxRepo) {
      await this.outboxRepo.enqueue(outbox);
    }

    return { ...entry };
  }
}
