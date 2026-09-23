import { type NewOutboxInput, type OutboxRecord, OutboxRepository } from '@vp/core/repositories';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export class InMemoryOutboxRepository extends OutboxRepository {
  private readonly items = new Map<string, OutboxRecord>();

  async enqueue(item: NewOutboxInput): Promise<Result<OutboxRecord, DatabaseUnavailable>> {
    const id = item.id || uuidv7();
    const record: OutboxRecord = {
      id,
      kind: item.kind,
      payload: item.payload,
      createdAt: new Date(),
      publishedAt: null,
      attempts: 0,
    };
    this.items.set(id, record);
    return ok({ ...record });
  }

  async claimBatch(limit: number): Promise<Result<OutboxRecord[], DatabaseUnavailable>> {
    const results: OutboxRecord[] = [];
    const sorted = Array.from(this.items.values())
      .filter((r) => r.publishedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const item of sorted) {
      if (results.length >= limit) break;
      results.push({ ...item });
    }
    return ok(results);
  }

  async markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const item = this.items.get(id);
    if (!item) return ok(false);
    item.publishedAt = new Date();
    return ok(true);
  }

  async recordAttempt(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const item = this.items.get(id);
    if (!item) return ok(false);
    item.attempts += 1;
    return ok(true);
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
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
    return ok(item ? { ...item } : null);
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
    return Array.from(this.items.values()).map((r) => ({ ...r }));
  }
}
