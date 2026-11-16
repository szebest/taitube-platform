import type { ExportScope } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelAnalyticsExportRow, VideoAnalyticsExportRow } from '@vp/domain';
import { and, asc, eq, gt, gte, isNull, lte, sql } from 'drizzle-orm';
import { keysetPast } from '../scopes/index';
import type { PostgresDatabase } from './types';

const {
  videoViewsDaily: d,
  videoRetentionMilestones: r,
  videos: v,
  subscriptionEvents: se,
} = schema;

export interface VideoDayKey {
  videoId: string;
  day: string;
}

export interface RetentionKey {
  videoId: string;
  percent: number;
}

const dayOf = (column: typeof se.occurredAt) =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;

function within(day: typeof d.viewDate, { from, to }: ExportScope['range']) {
  return and(from ? gte(day, from) : undefined, to ? lte(day, to) : undefined);
}

export async function videoDailyRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: VideoDayKey | null,
  limit: number
): Promise<VideoAnalyticsExportRow[]> {
  const rows = await db
    .select({
      videoId: d.videoId,
      title: v.title,
      day: d.viewDate,
      views: d.views,
      watchSeconds: d.watchSeconds,
    })
    .from(d)
    .innerJoin(v, eq(v.id, d.videoId))
    .where(
      and(
        eq(v.ownerId, scope.ownerId),
        isNull(v.deletedAt),
        within(d.viewDate, scope.range),
        keysetPast(d.videoId, d.viewDate, after && { sort: after.videoId, tie: after.day }, 'asc')
      )
    )
    .orderBy(asc(d.videoId), asc(d.viewDate))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    series: 'daily' as const,
    percent: null,
    viewers: null,
  }));
}

export async function retentionRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: RetentionKey | null,
  limit: number
): Promise<VideoAnalyticsExportRow[]> {
  const rows = await db
    .select({ videoId: r.videoId, title: v.title, percent: r.percent, viewers: r.viewers })
    .from(r)
    .innerJoin(v, eq(v.id, r.videoId))
    .where(
      and(
        eq(v.ownerId, scope.ownerId),
        isNull(v.deletedAt),
        keysetPast(
          r.videoId,
          r.percent,
          after && { sort: after.videoId, tie: String(after.percent) },
          'asc'
        )
      )
    )
    .orderBy(asc(r.videoId), asc(r.percent))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    series: 'retention' as const,
    day: null,
    views: null,
    watchSeconds: null,
  }));
}

/** Views by day and subscriber changes by day, joined on the day, so a day with either is a row. */
export async function channelDayRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: string | null,
  limit: number
): Promise<ChannelAnalyticsExportRow[]> {
  const { from, to } = scope.range;
  const views = db
    .select({
      day: sql<string>`${d.viewDate}::text`.as('view_day'),
      views: sql<string>`sum(${d.views})`.as('views'),
      watchSeconds: sql<string>`sum(${d.watchSeconds})`.as('watch_seconds'),
    })
    .from(d)
    .innerJoin(v, eq(v.id, d.videoId))
    .where(and(eq(v.ownerId, scope.ownerId), isNull(v.deletedAt)))
    .groupBy(d.viewDate)
    .as('views_by_day');
  const subscribers = db
    .select({
      day: dayOf(se.occurredAt).as('subscriber_day'),
      gained: sql<string>`count(*) filter (where ${se.delta} = 1)`.as('gained'),
      lost: sql<string>`count(*) filter (where ${se.delta} = -1)`.as('lost'),
    })
    .from(se)
    .where(eq(se.channelId, scope.channelId))
    .groupBy(dayOf(se.occurredAt))
    .as('subscribers_by_day');
  const day = sql<string>`coalesce(${views.day}, ${subscribers.day})`;

  const rows = await db
    .select({
      day,
      views: views.views,
      watchSeconds: views.watchSeconds,
      gained: subscribers.gained,
      lost: subscribers.lost,
    })
    .from(views)
    .fullJoin(subscribers, eq(views.day, subscribers.day))
    .where(
      and(
        after ? gt(day, after) : undefined,
        from ? gte(day, from) : undefined,
        to ? lte(day, to) : undefined
      )
    )
    .orderBy(asc(day))
    .limit(limit);

  return rows.map((row) => ({
    day: row.day,
    views: Number(row.views ?? 0),
    watchSeconds: Number(row.watchSeconds ?? 0),
    subscribersGained: Number(row.gained ?? 0),
    subscribersLost: Number(row.lost ?? 0),
  }));
}
