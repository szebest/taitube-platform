import { ok, type Result } from '@kit/result';
import type { WatchPartyHousekeepingRepositoryPort } from '@vp/core/repositories';
import {
  isOpenWatchParty,
  WATCH_PARTY_TREND,
  type WatchPartyRoom,
  watchPartyTrendScore,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

export class InMemoryWatchPartyHousekeepingRepository implements WatchPartyHousekeepingRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async listOpen(
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>> {
    const page = [...this.store.rooms.values()]
      .filter((room) => room.status === 'open' && (afterId === null || room.id > afterId))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .slice(0, limit);
    return ok(page.map((room) => ({ ...room, playback: { ...room.playback } })));
  }

  async refreshTrendScores(at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const windowStart = at.getTime() - WATCH_PARTY_TREND.joinWindowMs;
    for (const room of this.store.rooms.values()) {
      if (!isOpenWatchParty(room)) continue;
      const recentJoins = [...this.store.members.values()].filter(
        (seat) => seat.roomId === room.id && seat.joinedAt.getTime() >= windowStart
      ).length;
      this.store.trendScores.set(
        room.id,
        watchPartyTrendScore({
          recentJoins,
          present: room.presentCount,
          ageMs: at.getTime() - room.createdAt.getTime(),
        })
      );
    }
    return ok();
  }

  async databaseClock(): Promise<Result<Date, DatabaseUnavailable>> {
    return ok(new Date());
  }

  async purgeClosedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const gone = new Set(
      [...this.store.rooms.values()]
        .filter(
          (room) => room.status === 'closed' && room.closedAt !== null && room.closedAt < cutoff
        )
        .map(({ id }) => id)
    );
    for (const id of gone) {
      this.store.rooms.delete(id);
      this.store.searchTexts.delete(id);
      this.store.trendScores.delete(id);
    }
    for (const [id, row] of this.store.reports) {
      if (gone.has(row.report.roomId)) this.store.reports.delete(id);
    }
    for (const [key, row] of this.store.interest) {
      if (gone.has(row.roomId)) this.store.interest.delete(key);
    }
    for (const table of [
      this.store.members,
      this.store.roles,
      this.store.memberRoles,
      this.store.bans,
      this.store.queue,
      this.store.messages,
      this.store.invites,
      this.store.inviteLinks,
      this.store.controls,
    ]) {
      for (const [key, row] of table) {
        if (row.roomId !== null && gone.has(row.roomId)) table.delete(key);
      }
    }
    return ok(gone.size);
  }

  async purgeMessagesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    let removed = 0;
    for (const [id, message] of this.store.messages) {
      if (message.createdAt < cutoff) {
        this.store.messages.delete(id);
        removed += 1;
      }
    }
    return ok(removed);
  }
}
