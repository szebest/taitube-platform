import type { NewWatchPartyMessage, WatchPartyMessageRepositoryPort } from '@vp/core/repositories';
import type { WatchPartyMessage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

const byId = (a: WatchPartyMessage, b: WatchPartyMessage) => (a.id < b.id ? -1 : 1);

export class InMemoryWatchPartyMessageRepository implements WatchPartyMessageRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async append(
    message: NewWatchPartyMessage
  ): Promise<Result<WatchPartyMessage, DatabaseUnavailable>> {
    const stored: WatchPartyMessage = { ...message, pinned: false, removedAt: null };
    this.store.messages.set(stored.id, stored);
    return ok({ ...stored });
  }

  async listAfter(
    roomId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyMessage[], DatabaseUnavailable>> {
    if (limit <= 0) return ok([]);
    const shown = this.shown(roomId);
    const page =
      afterId === null
        ? shown.slice(Math.max(0, shown.length - limit))
        : shown.filter((row) => row.id > afterId).slice(0, limit);
    return ok(page.map((row) => ({ ...row })));
  }

  async listRemovedSince(
    roomId: string,
    afterId: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const sent = this.store.messages.get(afterId);
    if (sent?.roomId !== roomId) return ok([]);
    const removed = [...this.store.messages.values()]
      .filter((row) => row.roomId === roomId && row.removedAt !== null)
      .filter((row) => (row.removedAt?.getTime() ?? 0) >= sent.createdAt.getTime())
      .sort((a, b) => (a.removedAt?.getTime() ?? 0) - (b.removedAt?.getTime() ?? 0) || byId(a, b))
      .slice(0, Math.max(0, limit));
    return ok(removed.map((row) => row.id));
  }

  async find(
    roomId: string,
    messageId: string
  ): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>> {
    const row = this.store.messages.get(messageId);
    return ok(row?.roomId === roomId && row.removedAt === null ? { ...row } : null);
  }

  async remove(
    roomId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.store.messages.get(messageId);
    if (row?.roomId !== roomId || row.removedAt !== null) return ok(false);
    this.store.messages.set(messageId, { ...row, removedAt: at });
    return ok(true);
  }

  async pin(
    roomId: string,
    messageId: string | null
  ): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>> {
    if (!this.store.rooms.has(roomId)) return ok(null);
    for (const row of this.store.messages.values()) {
      if (row.roomId === roomId && row.pinned)
        this.store.messages.set(row.id, { ...row, pinned: false });
    }
    const row = messageId === null ? undefined : this.store.messages.get(messageId);
    if (row?.roomId !== roomId || row.kind !== 'text' || row.removedAt !== null) return ok(null);
    const pinned = { ...row, pinned: true };
    this.store.messages.set(pinned.id, pinned);
    return ok({ ...pinned });
  }

  async findPinned(roomId: string): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>> {
    const pinned = [...this.store.messages.values()].find(
      (row) => row.roomId === roomId && row.pinned && row.removedAt === null
    );
    return ok(pinned ? { ...pinned } : null);
  }

  clear(): void {
    this.store.clear();
  }

  private shown(roomId: string): WatchPartyMessage[] {
    return [...this.store.messages.values()]
      .filter((row) => row.roomId === roomId && row.removedAt === null)
      .sort(byId);
  }
}
