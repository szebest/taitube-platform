import type { ChannelPostPlacement } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  isPostPublished,
  type ChannelPost,
  type ManagedPostCursor,
  type NewChannelAuditEntry,
  type NewUnpublishedPostInput,
  type PostPinOutcome,
  type PostStatus,
} from '@vp/domain';
import { postSubscribersOutbox } from '@vp/job-contracts';
import { type SQL, and, asc, count, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { msTimestamp } from '../scopes/index';
import { appendChannelAudit } from './channel-audit-writes';
import { toChannelPost } from './channel-post-queries';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

const { channelPosts: p } = schema;

const createdAt = msTimestamp(p.createdAt);

export async function countPendingPosts(db: PostgresDatabase, channelId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(p)
    .where(and(eq(p.channelId, channelId), inArray(p.status, ['draft', 'scheduled'])));
  return row?.total ?? 0;
}

export async function insertUnpublishedPost(
  tx: PostgresDatabase,
  input: NewUnpublishedPostInput,
  audit: NewChannelAuditEntry
): Promise<ChannelPost> {
  const now = new Date();
  const [row] = await tx
    .insert(p)
    .values({ ...input, kind: input.payload.kind, createdAt: now, updatedAt: now })
    .returning();
  if (!row) throw new Error('channel post insert returned no row');
  await appendChannelAudit(tx, audit);
  return toChannelPost(row);
}

export function placementColumns(placement: ChannelPostPlacement | undefined) {
  return placement ? { status: placement.status, publishAt: placement.publishAt } : {};
}

/** The status guard is the compare-and-set: of two callers, one updates a row and the other none. */
export async function promotePost(
  tx: PostgresDatabase,
  id: string,
  audit: NewChannelAuditEntry | null
): Promise<ChannelPost | null> {
  const now = new Date();
  const [row] = await tx
    .update(p)
    .set({ status: 'published', publishedAt: now, publishAt: null, updatedAt: now })
    .where(and(eq(p.id, id), inArray(p.status, ['draft', 'scheduled'])))
    .returning();
  if (!row) return null;
  if (audit) await appendChannelAudit(tx, audit);
  await enqueueNotificationJobs(tx, [postSubscribersOutbox({ postId: row.id })]);
  return toChannelPost(row);
}

export async function dueScheduledIds(
  db: PostgresDatabase,
  now: Date,
  limit: number
): Promise<string[]> {
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.status, 'scheduled'), lte(p.publishAt, now)))
    .orderBy(asc(p.publishAt), asc(p.id))
    .limit(limit);
  return rows.map((row) => row.id);
}

function managedCursorScope(cursor: ManagedPostCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(${createdAt}, ${p.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`;
}

export async function managedPostsPage(
  db: PostgresDatabase,
  channelId: string,
  options: { status: PostStatus | null; cursor: ManagedPostCursor | null; limit: number }
): Promise<ChannelPost[]> {
  const rows = await db
    .select()
    .from(p)
    .where(
      and(
        eq(p.channelId, channelId),
        options.status ? eq(p.status, options.status) : undefined,
        managedCursorScope(options.cursor)
      )
    )
    .orderBy(desc(createdAt), desc(p.id))
    .limit(options.limit + 1);
  return rows.map(toChannelPost);
}

export async function setPostPinned(
  tx: PostgresDatabase,
  args: { id: string; channelId: string; pinned: boolean; limit: number },
  audit: NewChannelAuditEntry
): Promise<PostPinOutcome> {
  const { id, channelId, pinned, limit } = args;
  await tx.execute(sql`select id from channels where id = ${channelId}::uuid for update`);
  const [post] = await tx
    .select({ status: p.status, pinnedAt: p.pinnedAt })
    .from(p)
    .where(and(eq(p.id, id), eq(p.channelId, channelId)));
  if (!post) return 'missing';
  if (!isPostPublished(post.status)) return 'not_published';
  if (pinned === (post.pinnedAt !== null)) return pinned ? 'pinned' : 'unpinned';
  if (pinned) {
    const [held] = await tx
      .select({ total: count() })
      .from(p)
      .where(and(eq(p.channelId, channelId), isNotNull(p.pinnedAt)));
    if ((held?.total ?? 0) >= limit) return 'limit';
  }
  await tx
    .update(p)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(eq(p.id, id));
  await appendChannelAudit(tx, audit);
  return pinned ? 'pinned' : 'unpinned';
}
