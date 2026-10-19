import {
  type NewUserEventInput,
  type OutboxRepository,
  type UserEventRecord,
  UserEventRepository,
} from '@vp/core/repositories';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import { userChannel } from '@vp/events';
import { type Result, map, ok } from '@vp/result';

export class InMemoryUserEventRepository extends UserEventRepository {
  private events: UserEventRecord[] = [];
  private nextId = 1;

  constructor(private readonly outboxRepo: OutboxRepository) {
    super();
  }

  async append(event: NewUserEventInput): Promise<Result<UserEventRecord, DatabaseUnavailable>> {
    const record: UserEventRecord = { ...event, id: this.nextId++, createdAt: new Date() };
    const enqueued = await this.outboxRepo.enqueue({
      kind: 'user-event',
      payload: {
        type: 'pubsub',
        channel: userChannel(record.userId),
        message: JSON.stringify({ id: record.id, type: record.type, payload: record.payload }),
      },
    });
    return map(enqueued, () => {
      this.events.push(record);
      return { ...record };
    });
  }

  async listFrom(
    userId: string,
    fromId: number,
    limit: number
  ): Promise<Result<UserEventRecord[], DatabaseUnavailable>> {
    return ok(
      this.events
        .filter((event) => event.userId === userId && event.id >= fromId)
        .slice(0, limit)
        .map((event) => ({ ...event }))
    );
  }

  async latestId(userId: string): Promise<Result<number, DatabaseUnavailable>> {
    const mine = this.events.filter((event) => event.userId === userId);
    return ok(mine.at(-1)?.id ?? 0);
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = Date.now() - retentionDays * MS_PER_DAY;
    const before = this.events.length;
    this.events = this.events.filter((event) => event.createdAt.getTime() >= cutoff);
    return ok(before - this.events.length);
  }

  clear(): void {
    this.events = [];
    this.nextId = 1;
  }
}
