import { ok, type Result } from '@kit/result';
import type { WatchPartyInterestRepositoryPort } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

export class InMemoryWatchPartyInterestRepository implements WatchPartyInterestRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async add(roomId: string, userId: string, at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const key = `${roomId}|${userId}`;
    if (!this.store.interest.has(key)) this.store.interest.set(key, { roomId, userId, at });
    return ok();
  }

  async remove(roomId: string, userId: string): Promise<Result<void, DatabaseUnavailable>> {
    this.store.interest.delete(`${roomId}|${userId}`);
    return ok();
  }

  async userIdsOf(roomId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = [...this.store.interest.values()]
      .filter((row) => row.roomId === roomId)
      .sort((a, b) => a.at.getTime() - b.at.getTime() || a.userId.localeCompare(b.userId));
    return ok(rows.map(({ userId }) => userId));
  }

  async openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = [...this.store.interest.values()]
      .filter((row) => row.userId === userId && this.store.rooms.get(row.roomId)?.status === 'open')
      .sort((a, b) => b.at.getTime() - a.at.getTime() || b.roomId.localeCompare(a.roomId));
    return ok(rows.map(({ roomId }) => roomId));
  }
}
