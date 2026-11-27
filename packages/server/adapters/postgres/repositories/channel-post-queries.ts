import type { ListChannelPostsOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelPost, ChannelPostCursor, ChannelPostEntry } from '@vp/domain';
import { type SQL, and, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzleWhere } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { channelPosts: p, postReactions: pr, channelSubscriptions: s } = schema;

type PostRow = typeof p.$inferSelect;

export function toChannelPost({
  kind: _kind,
  updatedAt: _updatedAt,
  ...row
}: PostRow): ChannelPost {
  return row;
}

const at = (date: Date | null) => sql`${date?.toISOString() ?? null}::timestamptz`;

/** Pinned first by pin time, unpinned last, then newest; the same order the index holds. */
const pinnedRank = sql`coalesce(${p.pinnedAt}, '-infinity'::timestamptz)`;

function channelCursorScope(cursor: ChannelPostCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const pinned = sql`coalesce(${at(cursor.pinnedAt)}, '-infinity'::timestamptz)`;
  return sql`(${pinnedRank}, ${p.publishedAt}, ${p.id}) < (${pinned}, ${at(cursor.publishedAt)}, ${cursor.id}::uuid)`;
}

function feedCursorScope(cursor: ChannelPostCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(${p.publishedAt}, ${p.id}) < (${at(cursor.publishedAt)}, ${cursor.id}::uuid)`;
}

const likedBy = (viewerId: string | null) =>
  viewerId === null
    ? sql<boolean>`false`
    : sql<boolean>`exists (select 1 from ${pr} where ${pr.postId} = ${p.id} and ${pr.userId} = ${viewerId})`;

function entries(
  db: PostgresDatabase,
  where: SQL | undefined,
  orderBy: SQL[],
  { viewerId, limit }: ListChannelPostsOptions
) {
  return db
    .select({ post: p, likedByViewer: likedBy(viewerId) })
    .from(p)
    .where(drizzleWhere(eq(p.status, 'published'), where))
    .orderBy(...orderBy)
    .limit(limit + 1);
}

const toEntry = ({ post, likedByViewer }: { post: PostRow; likedByViewer: boolean }) =>
  ({ post: toChannelPost(post), likedByViewer }) satisfies ChannelPostEntry;

export async function channelPostsPage(
  db: PostgresDatabase,
  channelId: string,
  options: ListChannelPostsOptions
): Promise<ChannelPostEntry[]> {
  const rows = await entries(
    db,
    and(eq(p.channelId, channelId), channelCursorScope(options.cursor)),
    [desc(pinnedRank), desc(p.publishedAt), desc(p.id)],
    options
  );
  return rows.map(toEntry);
}

export async function feedPostsPage(
  db: PostgresDatabase,
  subscriberChannelId: string,
  options: ListChannelPostsOptions
): Promise<ChannelPostEntry[]> {
  const followed = db
    .select({ channelId: s.channelId })
    .from(s)
    .where(eq(s.subscriberChannelId, subscriberChannelId));
  const rows = await entries(
    db,
    and(inArray(p.channelId, followed), feedCursorScope(options.cursor)),
    [desc(p.publishedAt), desc(p.id)],
    options
  );
  return rows.map(toEntry);
}
