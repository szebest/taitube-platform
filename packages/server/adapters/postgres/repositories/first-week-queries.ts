import * as schema from '@vp/db';
import {
  FIRST_WEEK_DAYS,
  type FirstWeekRow,
  PUBLIC_FEED_STATUS,
  PUBLIC_FEED_VISIBILITY,
  type PeerVideo,
} from '@vp/domain';
import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { videoViewsDaily: d, videos: v } = schema;

export async function firstWeekRows(
  db: PostgresDatabase,
  videoIds: readonly string[]
): Promise<FirstWeekRow[]> {
  if (videoIds.length === 0) return [];
  const readyDay = sql`(${v.readyAt} at time zone 'UTC')::date`;
  const dayOffset = sql<number>`(${d.viewDate} - ${readyDay})`;
  const rows = await db
    .select({ videoId: d.videoId, dayOffset, views: sql<string>`sum(${d.views})` })
    .from(d)
    .innerJoin(v, eq(v.id, d.videoId))
    .where(
      and(
        inArray(d.videoId, [...videoIds]),
        isNotNull(v.readyAt),
        sql`${dayOffset} >= 0 and ${dayOffset} < ${FIRST_WEEK_DAYS}`
      )
    )
    .groupBy(d.videoId, dayOffset);

  return rows.map((row) => ({ ...row, views: Number(row.views) }));
}

export async function recentPeerVideos(
  db: PostgresDatabase,
  ownerId: string,
  excludeVideoId: string,
  readyBefore: Date,
  limit: number
): Promise<PeerVideo[]> {
  const rows = await db
    .select({ videoId: v.id, readyAt: v.readyAt })
    .from(v)
    .where(
      and(
        eq(v.ownerId, ownerId),
        ne(v.id, excludeVideoId),
        eq(v.visibility, PUBLIC_FEED_VISIBILITY),
        eq(v.status, PUBLIC_FEED_STATUS),
        isNull(v.deletedAt),
        isNotNull(v.readyAt),
        lte(v.readyAt, readyBefore)
      )
    )
    .orderBy(desc(v.readyAt), desc(v.id))
    .limit(limit);

  return rows.flatMap(({ videoId, readyAt }) => (readyAt ? [{ videoId, readyAt }] : []));
}
