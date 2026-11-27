import type { ListHeldThreadsOptions, ListVideoThreadsOptions } from '@vp/core/repositories';
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

const authorShadowed = sql<boolean>`exists (
  select 1 from ${r}
  where ${r.channelId} = ${t.channelId} and ${r.userId} = ${t.authorId} and ${r.kind} = 'shadow'
)`;

const pinnedRank = sql`coalesce(${msTimestamp(t.pinnedAt)}, '-infinity'::timestamptz)`;

const byPinThenAnchor = [desc(pinnedRank), asc(t.anchorMs), asc(t.id)];

async function entriesWhere(
  db: PostgresDatabase,
  where: SQL | undefined,
  limit: number,
  order: SQL[] = byPinThenAnchor
): Promise<VideoThreadEntry[]> {
  const rows = await db
    .select({
      ...getTableColumns(t),
      handle: ch.handle,
      displayName: ch.displayName,
      avatarUrl: ch.avatarUrl,
      markerReplies,
      markerRepliers,
      authorShadowed,
    })
    .from(t)
    .leftJoin(ch, eq(ch.id, t.authorChannelId))
    .where(and(isNull(t.deletedAt), where))
    .orderBy(...order)
    .limit(limit);

  return rows.map(
    ({ handle, displayName, avatarUrl, markerReplies, markerRepliers, authorShadowed, ...row }) => {
      const thread = toVideoThread(row);
      return {
        thread,
        author: { channelId: thread.authorChannelId, handle, displayName, avatarUrl },
        replyCount: thread.commentsCount,
        markerReplies,
        markerRepliers,
        authorShadowed,
      };
    }
  );
}

export function threadsOfVideo(
  db: PostgresDatabase,
  videoId: string,
  { viewer, limit }: ListVideoThreadsOptions
): Promise<VideoThreadEntry[]> {
  const published =
    and(eq(t.moderationState, 'published'), sql`not ${authorShadowed}`) ?? sql`true`;
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

/** Newest first, resumed from the `(createdAt, id)` of the last row of the page before. */
export function heldThreads(
  db: PostgresDatabase,
  { channelId, authorId, cursor, limit }: ListHeldThreadsOptions
): Promise<VideoThreadEntry[]> {
  const createdAt = msTimestamp(t.createdAt);
  const where = and(
    eq(t.channelId, channelId),
    eq(t.moderationState, 'held'),
    authorId === undefined ? undefined : eq(t.authorId, authorId),
    cursor
      ? sql`(${createdAt}, ${t.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
      : undefined
  );
  return entriesWhere(db, where, limit, [desc(createdAt), desc(t.id)]);
}
