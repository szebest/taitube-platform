import { type NewOutboxInput, type OutboxRecord, OutboxRepository } from '@vp/core/repositories';
import { uuidv7 } from 'uuidv7';

export class InMemoryOutboxRepository extends OutboxRepository {
  private readonly items = new Map<string, OutboxRecord>();

  async enqueue(item: NewOutboxInput): Promise<OutboxRecord> {
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
    return { ...record };
  }

  async claimBatch(limit = 50): Promise<OutboxRecord[]> {
    const results: OutboxRecord[] = [];
    const sorted = Array.from(this.items.values())
      .filter((r) => r.publishedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const item of sorted) {
      if (results.length >= limit) break;
      results.push({ ...item });
    }
    return results;
  }

  async markPublished(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;
    item.publishedAt = new Date();
    return true;
  }

  async recordAttempt(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;
    item.attempts += 1;
    return true;
  }

  async prune(retentionDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let count = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.publishedAt !== null && item.publishedAt < cutoff) {
        this.items.delete(id);
        count += 1;
      }
    }
    return count;
  }

  async findById(id: string): Promise<OutboxRecord | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
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
