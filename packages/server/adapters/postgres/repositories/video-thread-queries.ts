import type { ListVideoThreadsOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { VideoThread, VideoThreadEntry } from '@vp/domain';
import { type SQL, and, asc, desc, eq, getTableColumns, isNull, or, sql } from 'drizzle-orm';
import { msTimestamp } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { videoThreads: t, channels: ch, comments: c, channelUserRestrictions: r } = schema;

type ThreadRow = typeof t.$inferSelect;

export function toVideoThread({ deletedAt: _deletedAt, ...row }: ThreadRow): VideoThread {
  return row;
}

/** What a reply counts toward a marker: public, and not by someone the channel restricted. */
const countsTowardMarker = sql`${c.targetType} = 'thread' and ${c.targetId} = ${t.id}
  and ${c.deletedAt} is null and ${c.moderationState} = 'published'
  and not exists (
    select 1 from ${r}
    where ${r.channelId} = ${c.channelId} and ${r.userId} = ${c.authorId}
      and (${r.kind} = 'shadow' or ${r.expiresAt} is null or ${r.expiresAt} > now())
  )`;

const markerReplies = sql<number>`(select count(*)::int from ${c} where ${countsTowardMarker})`;
const markerRepliers = sql<number>`(select count(distinct ${c.authorId})::int from ${c} where ${countsTowardMarker})`;

const pinnedRank = sql`coalesce(${msTimestamp(t.pinnedAt)}, '-infinity'::timestamptz)`;

async function entriesWhere(
  db: PostgresDatabase,
  where: SQL | undefined,
  limit: number
): Promise<VideoThreadEntry[]> {
  const rows = await db
    .select({
      ...getTableColumns(t),
      handle: ch.handle,
      displayName: ch.displayName,
      avatarUrl: ch.avatarUrl,
      markerReplies,
      markerRepliers,
    })
    .from(t)
    .leftJoin(ch, eq(ch.id, t.authorChannelId))
    .where(and(isNull(t.deletedAt), where))
    .orderBy(desc(pinnedRank), asc(t.anchorMs), asc(t.id))
    .limit(limit);

  return rows.map(({ handle, displayName, avatarUrl, markerReplies, markerRepliers, ...row }) => {
    const thread = toVideoThread(row);
    return {
      thread,
      author: { channelId: thread.authorChannelId, handle, displayName, avatarUrl },
      replyCount: thread.commentsCount,
      markerReplies,
      markerRepliers,
    };
  });
}

export function threadsOfVideo(
  db: PostgresDatabase,
  videoId: string,
  { viewer, limit }: ListVideoThreadsOptions
): Promise<VideoThreadEntry[]> {
  const published = eq(t.moderationState, 'published');
  const visible = viewer ? (or(published, eq(t.authorId, viewer.id)) ?? published) : published;
  return entriesWhere(db, and(eq(t.videoId, videoId), visible), limit);
}

export async function threadEntry(
  db: PostgresDatabase,
  id: string
): Promise<VideoThreadEntry | null> {
  const [entry] = await entriesWhere(db, eq(t.id, id), 1);
  return entry ?? null;
}
