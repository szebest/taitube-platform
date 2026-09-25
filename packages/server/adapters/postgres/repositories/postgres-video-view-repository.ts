import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ChannelViewTotals,
  type DailyViews,
  type TopVideo,
  type ViewBatch,
  type ViewBatchOutcome,
  type ViewDateRange,
  mergeViewCounts,
  viewsByVideo,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, fromPromise, map } from '@vp/result';
import { and, asc, between, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videos: v, videoViewsDaily: d, videoViewBatches: batches } = schema;

export class PostgresVideoViewRepository implements VideoViewRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async applyBatch(batch: ViewBatch): Promise<Result<ViewBatchOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<ViewBatchOutcome> => {
          const [claimed] = await tx
            .insert(batches)
            .values({ batchId: batch.batchId })
            .onConflictDoNothing()
            .returning({ batchId: batches.batchId });
          if (!claimed) return { type: 'already-applied' };

          const counts = mergeViewCounts(batch.counts);
          if (counts.length === 0) return { type: 'applied', views: 0 };

          const known = await tx
            .select({ id: v.id })
            .from(v)
            .where(inArray(v.id, [...new Set(counts.map((count) => count.videoId))]));
          const existing = new Set(known.map((row) => row.id));
          const kept = counts.filter((count) => existing.has(count.videoId));
          if (kept.length === 0) return { type: 'applied', views: 0 };

          const deltas = viewsByVideo(kept);
          const tuples = sql.join(
            deltas.map(({ videoId, views }) => sql`(${videoId}::uuid, ${views}::bigint)`),
            sql`, `
          );
          await tx
            .update(v)
            .set({ viewsCount: sql`${v.viewsCount} + b.delta` })
            .from(sql`(VALUES ${tuples}) AS b(video_id, delta)`)
            .where(eq(v.id, sql`b.video_id`));

          await tx
            .insert(d)
            .values([...kept])
            .onConflictDoUpdate({
              target: [d.videoId, d.viewDate],
              set: {
                views: sql`${d.views} + excluded.views`,
                watchSeconds: sql`${d.watchSeconds} + excluded.watch_seconds`,
              },
            });

          return { type: 'applied', views: deltas.reduce((sum, delta) => sum + delta.views, 0) };
        }),
      databaseUnavailable.during('applyViewBatch')
    );
  }

  async forgetBatchesBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const forgotten = await fromPromise(
      () =>
        this.db
          .delete(batches)
          .where(lt(batches.appliedAt, cutoff))
          .returning({ batchId: batches.batchId }),
      databaseUnavailable.during('forgetViewBatches')
    );

    return map(forgotten, (rows) => rows.length);
  }

  async videoTimeline(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select({ viewDate: d.viewDate, views: d.views, watchSeconds: d.watchSeconds })
          .from(d)
          .where(and(eq(d.videoId, videoId), between(d.viewDate, range.from, range.to)))
          .orderBy(asc(d.viewDate)),
      databaseUnavailable.during('videoTimeline')
    );
  }

  async channelTimeline(
    ownerId: string,
    range: ViewDateRange
  ): Promise<Result<DailyViews[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            viewDate: d.viewDate,
            views: sql<string>`sum(${d.views})`,
            watchSeconds: sql<string>`sum(${d.watchSeconds})`,
          })
          .from(d)
          .innerJoin(v, eq(v.id, d.videoId))
          .where(
            and(
              eq(v.ownerId, ownerId),
              isNull(v.deletedAt),
              between(d.viewDate, range.from, range.to)
            )
          )
          .groupBy(d.viewDate)
          .orderBy(asc(d.viewDate)),
      databaseUnavailable.during('channelTimeline')
    );

    return map(rows, (found) =>
      found.map((row) => ({
        viewDate: row.viewDate,
        views: Number(row.views),
        watchSeconds: Number(row.watchSeconds),
      }))
    );
  }

  async channelTotals(ownerId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            totalViews: sql<string>`coalesce(sum(${v.viewsCount}), 0)`,
            videoCount: sql<string>`count(*)`,
          })
          .from(v)
          .where(and(eq(v.ownerId, ownerId), isNull(v.deletedAt))),
      databaseUnavailable.during('channelTotals')
    );

    return map(rows, ([row]) => ({
      totalViews: Number(row?.totalViews ?? 0),
      videoCount: Number(row?.videoCount ?? 0),
    }));
  }

  async topVideos(
    ownerId: string,
    range: ViewDateRange,
    limit: number
  ): Promise<Result<TopVideo[], DatabaseUnavailable>> {
    const inRange = sql<string>`sum(${d.views})`;
    const rows = await fromPromise(
      () =>
        this.db
          .select({ videoId: v.id, title: v.title, totalViews: v.viewsCount, views: inRange })
          .from(v)
          .innerJoin(d, eq(d.videoId, v.id))
          .where(
            and(
              eq(v.ownerId, ownerId),
              isNull(v.deletedAt),
              between(d.viewDate, range.from, range.to)
            )
          )
          .groupBy(v.id)
          .orderBy(desc(inRange), asc(v.id))
          .limit(limit),
      databaseUnavailable.during('topVideos')
    );

    return map(rows, (found) => found.map((row) => ({ ...row, views: Number(row.views) })));
  }
}
