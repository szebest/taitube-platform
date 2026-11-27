import { fromPromise, map, type Result } from '@kit/result';
import type { WatchPartyHousekeepingRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { WATCH_PARTY_TREND, type WatchPartyRoom } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { watchPartyRooms: rooms, watchPartyMessages: messages, watchPartyMembers: members } = schema;

export class PostgresWatchPartyHousekeepingRepository implements WatchPartyHousekeepingRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async listOpen(
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(rooms)
          .where(
            afterId === null
              ? eq(rooms.status, 'open')
              : and(eq(rooms.status, 'open'), gt(rooms.id, afterId))
          )
          .orderBy(asc(rooms.id))
          .limit(limit),
      databaseUnavailable.during('listOpenWatchParties')
    );
    return map(rows, (found) =>
      found.map(({ trendScore: _trendScore, searchText: _searchText, ...room }) => room)
    );
  }

  async refreshTrendScores(at: Date): Promise<Result<void, DatabaseUnavailable>> {
    const { joinWindowMs, ageOffsetHours, exponent } = WATCH_PARTY_TREND;
    const instant = sql`${at.toISOString()}::timestamptz`;
    const windowStart = sql`${new Date(at.getTime() - joinWindowMs).toISOString()}::timestamptz`;
    const recentJoins = sql`(select count(*) from ${members} where ${members.roomId} = ${rooms.id} and ${members.joinedAt} >= ${windowStart})`;
    const ageHours = sql`(greatest(0, extract(epoch from (${instant} - ${rooms.createdAt}))) / 3600)`;
    const refreshed = await fromPromise(
      () =>
        this.db
          .update(rooms)
          .set({
            trendScore: sql`(${recentJoins} + ${rooms.presentCount})::double precision / power(${ageHours} + ${sql.raw(String(ageOffsetHours))}, ${sql.raw(String(exponent))})`,
          })
          .where(eq(rooms.status, 'open')),
      databaseUnavailable.during('refreshWatchPartyTrendScores')
    );
    return map(refreshed, () => undefined);
  }

  async databaseClock(): Promise<Result<Date, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ epochMs: sql<string>`(extract(epoch from clock_timestamp()) * 1000)::text` })
          .from(sql`(values (1)) as one(n)`),
      databaseUnavailable.during('readDatabaseClock')
    );
    return map(rows, ([row]) => new Date(Number(row?.epochMs)));
  }

  async purgeClosedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const removed = await fromPromise(
      () =>
        this.db
          .delete(rooms)
          .where(and(eq(rooms.status, 'closed'), lt(rooms.closedAt, cutoff)))
          .returning({ id: rooms.id }),
      databaseUnavailable.during('purgeClosedWatchParties')
    );
    return map(removed, (rows) => rows.length);
  }

  async purgeMessagesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const removed = await fromPromise(
      () =>
        this.db
          .delete(messages)
          .where(lt(messages.createdAt, cutoff))
          .returning({ id: messages.id }),
      databaseUnavailable.during('purgeWatchPartyMessages')
    );
    return map(removed, (rows) => rows.length);
  }
}
