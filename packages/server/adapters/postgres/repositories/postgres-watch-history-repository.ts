import type { ListWatchHistoryOptions, WatchHistoryRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { NewWatchProgress, WatchHistoryEntry, WatchProgress } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, fromPromise, map } from '@vp/result';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, watchableVideoScope } from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import type { PostgresDatabase } from './types';

const { watchHistory: wh, videos: v, channels: ch } = schema;

const progressColumns = {
  videoId: wh.videoId,
  progressSeconds: wh.progressSeconds,
  durationSeconds: wh.durationSeconds,
  watchedAt: wh.watchedAt,
};

export class PostgresWatchHistoryRepository implements WatchHistoryRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async record(progress: NewWatchProgress): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db
          .insert(wh)
          .values(progress)
          .onConflictDoUpdate({
            target: [wh.userId, wh.videoId],
            set: {
              progressSeconds: sql`excluded.progress_seconds`,
              durationSeconds: sql`excluded.duration_seconds`,
              watchedAt: sql`excluded.watched_at`,
            },
            setWhere: sql`${wh.watchedAt} <= excluded.watched_at`,
          }),
      databaseUnavailable.during('recordWatchProgress')
    );
    return map(written, () => undefined);
  }

  async find(
    userId: string,
    videoId: string
  ): Promise<Result<WatchProgress | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select(progressColumns)
          .from(wh)
          .where(and(eq(wh.userId, userId), eq(wh.videoId, videoId))),
      databaseUnavailable.during('findWatchProgress')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async list(
    viewer: UserContext,
    { cursor, limit }: ListWatchHistoryOptions
  ): Promise<Result<WatchHistoryEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            id: wh.id,
            ...progressColumns,
            video: getTableColumns(v),
            ...channelCardColumns,
          })
          .from(wh)
          .innerJoin(v, eq(v.id, wh.videoId))
          .leftJoin(ch, eq(ch.userId, v.ownerId))
          .where(
            drizzleWhere(
              eq(wh.userId, viewer.id),
              watchableVideoScope(viewer),
              keysetBefore(
                wh.watchedAt,
                wh.id,
                cursor && { sort: cursor.watchedAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(wh.watchedAt), desc(wh.id))
          .limit(limit + 1),
      databaseUnavailable.during('listWatchHistory')
    );
    return map(rows, (found) =>
      found.map(({ channelId, handle, displayName, avatarUrl, ...entry }) => ({
        ...entry,
        channel: toChannelCard({ channelId, handle, displayName, avatarUrl }),
      }))
    );
  }

  async remove(userId: string, videoId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(wh)
          .where(and(eq(wh.userId, userId), eq(wh.videoId, videoId)))
          .returning({ id: wh.id }),
      databaseUnavailable.during('removeWatchProgress')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async removeAll(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(wh).where(eq(wh.userId, userId)).returning({ videoId: wh.videoId }),
      databaseUnavailable.during('clearWatchHistory')
    );
    return map(rows, (removed) => removed.map((row) => row.videoId));
  }
}
