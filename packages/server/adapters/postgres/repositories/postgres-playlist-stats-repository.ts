import { type Result, fromPromise } from '@kit/result';
import type { PlaylistStatsRead, PlaylistStatsRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { PLAYLIST_TOP_ITEMS, type ViewDateRange } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type SQLWrapper, and, asc, between, desc, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { playlistStatsDaily: daily, playlistPlaysDaily: plays, videos: v } = schema;

const total = (column: SQLWrapper) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

export class PostgresPlaylistStatsRepository implements PlaylistStatsRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async statsOf(
    playlistId: string,
    { from, to }: ViewDateRange
  ): Promise<Result<PlaylistStatsRead, DatabaseUnavailable>> {
    return await fromPromise(async () => {
      const [totals] = await this.db
        .select({
          opens: total(daily.opens),
          plays: total(daily.plays),
          follows: total(daily.follows),
          forks: total(daily.forks),
        })
        .from(daily)
        .where(and(eq(daily.playlistId, playlistId), between(daily.day, from, to)));
      const played = sql<number>`sum(${plays.plays})`.mapWith(Number);
      const topItems = await this.db
        .select({ videoId: plays.videoId, title: v.title, plays: played })
        .from(plays)
        .innerJoin(v, eq(v.id, plays.videoId))
        .where(and(eq(plays.playlistId, playlistId), between(plays.day, from, to)))
        .groupBy(plays.videoId, v.title)
        .orderBy(desc(played), asc(plays.videoId))
        .limit(PLAYLIST_TOP_ITEMS);
      return {
        totals: totals ?? { opens: 0, plays: 0, follows: 0, forks: 0 },
        topItems,
      };
    }, databaseUnavailable.during('readPlaylistStats'));
  }
}
