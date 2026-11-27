import { fromPromise, map, type Result } from '@kit/result';
import type { WatchPartyInterestRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { watchPartyInterest: interest, watchPartyRooms: rooms } = schema;

export class PostgresWatchPartyInterestRepository implements WatchPartyInterestRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async add(roomId: string, userId: string, at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const added = await fromPromise(
      () =>
        this.db
          .insert(interest)
          .values({ roomId, userId, createdAt: at })
          .onConflictDoNothing({ target: [interest.roomId, interest.userId] }),
      databaseUnavailable.during('addWatchPartyInterest')
    );
    return map(added, () => undefined);
  }

  async remove(roomId: string, userId: string): Promise<Result<void, DatabaseUnavailable>> {
    const removed = await fromPromise(
      () =>
        this.db
          .delete(interest)
          .where(and(eq(interest.roomId, roomId), eq(interest.userId, userId))),
      databaseUnavailable.during('removeWatchPartyInterest')
    );
    return map(removed, () => undefined);
  }

  async userIdsOf(roomId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ userId: interest.userId })
          .from(interest)
          .where(eq(interest.roomId, roomId))
          .orderBy(asc(interest.createdAt), asc(interest.userId)),
      databaseUnavailable.during('listWatchPartyInterested')
    );
    return map(rows, (found) => found.map(({ userId }) => userId));
  }

  async openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ roomId: interest.roomId })
          .from(interest)
          .innerJoin(rooms, eq(rooms.id, interest.roomId))
          .where(and(eq(interest.userId, userId), eq(rooms.status, 'open')))
          .orderBy(desc(interest.createdAt), desc(interest.roomId)),
      databaseUnavailable.during('listWatchPartyInterestRooms')
    );
    return map(rows, (found) => found.map(({ roomId }) => roomId));
  }
}
