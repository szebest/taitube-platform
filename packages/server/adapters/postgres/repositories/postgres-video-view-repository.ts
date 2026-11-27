import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { type Result, fromPromise, map } from '@kit/result';
import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ChannelViewTotals,
  type DailyViews,
  type DeviceViews,
  type FirstWeekRow,
  type PeerVideo,
  type HourlyViews,
  type RetentionPoint,
  type TopVideo,
  type ViewBatch,
  type ViewBatchOutcome,
  type ViewDateRange,
  type ViewHourRange,
} from '@vp/domain';
import { and, asc, between, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { firstWeekRows, recentPeerVideos } from './first-week-queries';
import type { PostgresDatabase } from './types';
import { applyViewBatch } from './view-batch-writes';

const {
  videos: v,
  videoViewsDaily: d,
  videoViewsDeviceDaily: dev,
  videoViewsHourly: h,
  videoViewBatches: batches,
  videoRetentionMilestones: milestones,
} = schema;

function hourBounds(range: ViewHourRange): [Date, Date] {
  return [new Date(range.from), new Date(range.to)];
}

export class PostgresVideoViewRepository implements VideoViewRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async applyBatch(batch: ViewBatch): Promise<Result<ViewBatchOutcome, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => applyViewBatch(tx, batch)),
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

  async forgetHoursBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const forgotten = await fromPromise(
      () => this.db.delete(h).where(lt(h.viewHour, cutoff)).returning({ videoId: h.videoId }),
      databaseUnavailable.during('forgetViewHours')
    );

    return map(forgotten, (rows) => rows.length);
  }

  async retentionCurve(videoId: string): Promise<Result<RetentionPoint[], DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db
          .select({ percent: milestones.percent, viewers: milestones.viewers })
          .from(milestones)
          .where(eq(milestones.videoId, videoId))
          .orderBy(asc(milestones.percent)),
      databaseUnavailable.during('retentionCurve')
    );
  }

  async videoDevices(
    videoId: string,
    range: ViewDateRange
  ): Promise<Result<DeviceViews[], DatabaseUnavailable>> {
    const views = sql<string>`sum(${dev.views})`;
    const rows = await fromPromise(
      () =>
        this.db
          .select({ device: dev.device, views })
          .from(dev)
          .where(and(eq(dev.videoId, videoId), between(dev.viewDate, range.from, range.to)))
          .groupBy(dev.device)
          .orderBy(desc(views), asc(dev.device)),
      databaseUnavailable.during('videoDevices')
    );

    return map(rows, (found) => found.map((row) => ({ ...row, views: Number(row.views) })));
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
    channelId: string,
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
              eq(v.channelId, channelId),
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

  async videoHourly(
    videoId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ viewHour: h.viewHour, views: h.views })
          .from(h)
          .where(and(eq(h.videoId, videoId), between(h.viewHour, ...hourBounds(range))))
          .orderBy(asc(h.viewHour)),
      databaseUnavailable.during('videoHourly')
    );

    return map(rows, (found) =>
      found.map((row) => ({ viewHour: row.viewHour.toISOString(), views: row.views }))
    );
  }

  async channelHourly(
    channelId: string,
    range: ViewHourRange
  ): Promise<Result<HourlyViews[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ viewHour: h.viewHour, views: sql<string>`sum(${h.views})` })
          .from(h)
          .innerJoin(v, eq(v.id, h.videoId))
          .where(
            and(
              eq(v.channelId, channelId),
              isNull(v.deletedAt),
              between(h.viewHour, ...hourBounds(range))
            )
          )
          .groupBy(h.viewHour)
          .orderBy(asc(h.viewHour)),
      databaseUnavailable.during('channelHourly')
    );

    return map(rows, (found) =>
      found.map((row) => ({ viewHour: row.viewHour.toISOString(), views: Number(row.views) }))
    );
  }

  async firstWeekViews(
    videoIds: readonly string[]
  ): Promise<Result<FirstWeekRow[], DatabaseUnavailable>> {
    return await fromPromise(
      () => firstWeekRows(this.db, videoIds),
      databaseUnavailable.during('firstWeekViews')
    );
  }

  async recentPeers(
    channelId: string,
    excludeVideoId: string,
    readyBefore: Date,
    limit: number
  ): Promise<Result<PeerVideo[], DatabaseUnavailable>> {
    return await fromPromise(
      () => recentPeerVideos(this.db, channelId, excludeVideoId, readyBefore, limit),
      databaseUnavailable.during('recentPeers')
    );
  }

  async channelTotals(channelId: string): Promise<Result<ChannelViewTotals, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            totalViews: sql<string>`coalesce(sum(${v.viewsCount}), 0)`,
            videoCount: sql<string>`count(*)`,
          })
          .from(v)
          .where(and(eq(v.channelId, channelId), isNull(v.deletedAt))),
      databaseUnavailable.during('channelTotals')
    );

    return map(rows, ([row]) => ({
      totalViews: Number(row?.totalViews ?? 0),
      videoCount: Number(row?.videoCount ?? 0),
    }));
  }

  async topVideos(
    channelId: string,
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
              eq(v.channelId, channelId),
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
