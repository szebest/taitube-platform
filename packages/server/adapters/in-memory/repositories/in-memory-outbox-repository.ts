import { type NewOutboxInput, type OutboxRecord, OutboxRepository } from '@vp/core/repositories';
import type { OutboxStatus } from '@vp/domain';
import { OUTBOX_CLAIM_LEASE_MS, OUTBOX_ROW, decideOutboxAttempt } from '@vp/domain-rules';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { type Clock, realClock } from './clock';

interface StoredOutboxRow extends OutboxRecord {
  claimableAt: Date | null;
}

const toRecord = ({ claimableAt: _lease, ...record }: StoredOutboxRow): OutboxRecord => record;

export class InMemoryOutboxRepository extends OutboxRepository {
  private readonly items = new Map<string, StoredOutboxRow>();

  constructor(private readonly now: Clock = realClock) {
    super();
  }

  async enqueue(item: NewOutboxInput): Promise<Result<OutboxRecord, DatabaseUnavailable>> {
    const id = item.id || uuidv7();
    const row: StoredOutboxRow = {
      id,
      kind: item.kind,
      payload: item.payload,
      createdAt: new Date(),
      publishedAt: null,
      attempts: 0,
      status: 'PENDING',
      claimableAt: null,
    };
    this.items.set(id, row);
    return ok(toRecord(row));
  }

  async claimBatch(limit: number): Promise<Result<OutboxRecord[], DatabaseUnavailable>> {
    const now = new Date();
    const claimed = Array.from(this.items.values())
      .filter((row) => this.isPending(row) && (row.claimableAt === null || row.claimableAt <= now))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);

    for (const row of claimed) row.claimableAt = new Date(now.getTime() + OUTBOX_CLAIM_LEASE_MS);
    return ok(claimed.map(toRecord));
  }

  async markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.items.get(id);
    if (!(row && this.isPending(row))) return ok(false);
    Object.assign(row, {
      status: OUTBOX_ROW.target('publish'),
      publishedAt: new Date(),
      claimableAt: null,
    });
    return ok(true);
  }

  async recordAttempt(id: string): Promise<Result<OutboxStatus | null, DatabaseUnavailable>> {
    const row = this.items.get(id);
    if (!(row && this.isPending(row))) return ok(null);
    const attempts = row.attempts + 1;
    const { status, claimableAt } = decideOutboxAttempt(attempts, new Date());
    Object.assign(row, { attempts, status, claimableAt });
    return ok(status);
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(this.now() - retentionDays * MS_PER_DAY);
    let count = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.publishedAt !== null && item.publishedAt < cutoff) {
        this.items.delete(id);
        count += 1;
      }
    }
    return ok(count);
  }

  async findById(id: string): Promise<Result<OutboxRecord | null, DatabaseUnavailable>> {
    const item = this.items.get(id);
    return ok(item ? toRecord(item) : null);
  }

  seedPublished(id: string, publishedAt: Date): void {
    const item = this.items.get(id);
    if (item) {
      item.publishedAt = publishedAt;
    }
  }

  clear(): void {
    this.items.clear();
  }

  getAll(): OutboxRecord[] {
    return Array.from(this.items.values()).map(toRecord);
  }

  private isPending(row: StoredOutboxRow): boolean {
    return OUTBOX_ROW.sources('publish').includes(row.status);
  }
}
