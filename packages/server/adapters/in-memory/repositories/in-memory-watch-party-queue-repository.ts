import type {
  NewSystemLine,
  NewWatchPartyQueueItem,
  QueueSnapshot,
  QueueWrite,
  WatchPartyQueueRepositoryPort,
} from '@vp/core/repositories';
import { appendPositions, type PositionWrite, type WatchPartyQueueItem } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

const MISSING: QueueWrite = { type: 'missing' };
const FULL: QueueWrite = { type: 'full' };

const byPosition = (a: WatchPartyQueueItem, b: WatchPartyQueueItem) =>
  a.position - b.position || (a.id < b.id ? -1 : 1);

const fresh = (item: NewWatchPartyQueueItem, position: number): WatchPartyQueueItem => ({
  ...item,
  position,
  playedAt: null,
  removedAt: null,
});

export class InMemoryWatchPartyQueueRepository implements WatchPartyQueueRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async list(roomId: string): Promise<Result<QueueSnapshot, DatabaseUnavailable>> {
    return ok(this.snapshot(roomId));
  }

  async append(
    roomId: string,
    items: readonly NewWatchPartyQueueItem[],
    limit: number
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    if (!this.store.rooms.has(roomId)) return ok(MISSING);
    const live = this.live(roomId);
    const pending = live.filter((item) => item.playedAt === null).length;
    if (pending + items.length > limit) return ok(FULL);

    const { renumber, positions } = appendPositions(live, items.length);
    this.writePositions(roomId, renumber);
    for (const [n, item] of items.entries()) {
      this.store.queue.set(item.id, { ...fresh(item, positions[n] ?? 0), roomId });
    }
    return ok(this.applied(roomId));
  }

  async move(
    roomId: string,
    writes: readonly PositionWrite[]
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    if (!this.store.rooms.has(roomId)) return ok(MISSING);
    this.writePositions(roomId, writes);
    return ok(this.applied(roomId));
  }

  async remove(
    roomId: string,
    itemId: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    const item = this.store.queue.get(itemId);
    if (!this.store.rooms.has(roomId) || item?.roomId !== roomId || item.removedAt !== null) {
      return ok(MISSING);
    }
    this.store.queue.set(itemId, { ...item, removedAt: at });
    if (line) this.store.appendSystemLine(roomId, line);
    return ok(this.applied(roomId));
  }

  async countPendingBy(
    roomId: string,
    memberKey: string
  ): Promise<Result<number, DatabaseUnavailable>> {
    return ok(
      this.live(roomId).filter((item) => item.addedBy === memberKey && item.playedAt === null)
        .length
    );
  }

  clear(): void {
    this.store.clear();
  }

  private live(roomId: string): WatchPartyQueueItem[] {
    return [...this.store.queue.values()]
      .filter((item) => item.roomId === roomId && item.removedAt === null)
      .sort(byPosition);
  }

  private snapshot(roomId: string): QueueSnapshot {
    return {
      items: this.live(roomId).map((item) => ({ ...item })),
      version: this.store.rooms.get(roomId)?.queueVersion ?? 0,
    };
  }

  private applied(roomId: string): QueueWrite {
    this.store.bumpQueueVersion(roomId);
    return { type: 'applied', queue: this.snapshot(roomId) };
  }

  private writePositions(roomId: string, writes: readonly PositionWrite[]): void {
    for (const { id, position } of writes) {
      const item = this.store.queue.get(id);
      if (item?.roomId === roomId) this.store.queue.set(id, { ...item, position });
    }
  }
}
