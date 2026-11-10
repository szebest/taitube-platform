import type { CommentLocator } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type CommentThread,
  commentCreated,
  commentHeld,
  type ModerationRecord,
  type NewChannelAuditEntry,
  type NewCommentInput,
  type NewCommentRemoval,
  PUBLISHED_AT_CREATION,
} from '@vp/domain';
import { commentOutbox } from '@vp/job-contracts';
import { type SQL, and, eq, ne, or, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope, publicCommentScope } from '../scopes/index';
import { appendChannelAudit, appendModerationRecord } from './channel-audit-writes';
import { threadById } from './comment-thread-query';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { videoComments: c, videos: v, commentRemovals } = schema;

/**
 * Every write that adds, removes or pins a comment takes the video row first, so a reply cannot
 * commit under a root whose removal is already running, and two pins cannot interleave.
 */
export async function lockVideo(
  tx: PostgresDatabase,
  videoId: string
): Promise<{ ownerId: string; title: string } | undefined> {
  const [video] = await tx
    .select({ ownerId: v.ownerId, title: v.title })
    .from(v)
    .where(eq(v.id, videoId))
    .for('update');
  return video;
}

/** @internal */
export async function isLive(tx: PostgresDatabase, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: c.id })
    .from(c)
    .where(drizzleWhere(eq(c.id, id), notDeletedScope(c)))
    .for('update');
  return Boolean(row);
}

/** Whether the comment is in `comments_count`: what an anonymous reader would see of it. */
async function isCounted(tx: PostgresDatabase, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: c.id })
    .from(c)
    .where(drizzleWhere(eq(c.id, id), notDeletedScope(c), publicCommentScope(null)));
  return Boolean(row);
}

/**
 * Of the comments a removal takes, how many were counted: a root and its public replies leave the
 * count, a held or hidden one never entered it.
 */
export async function countedAmong(tx: PostgresDatabase, where: SQL | undefined): Promise<number> {
  const rows = await tx
    .select({ id: c.id })
    .from(c)
    .where(drizzleWhere(where, notDeletedScope(c), publicCommentScope(null)));
  return rows.length;
}

/** What a comment that becomes public tells people: the notification job, and the owner's open tabs. */
export async function publish(
  tx: PostgresDatabase,
  comment: CommentThread,
  video: { ownerId: string; title: string }
): Promise<void> {
  await enqueueNotificationJobs(tx, [
    commentOutbox({ videoId: comment.videoId, commentId: comment.id }),
  ]);
  if (video.ownerId !== comment.authorId) {
    await appendUserEvent(tx, {
      userId: video.ownerId,
      ...commentCreated(comment, { id: comment.videoId, title: video.title }),
    });
  }
}

export async function insertComment(
  tx: PostgresDatabase,
  input: NewCommentInput
): Promise<CommentThread | null> {
  const video = await lockVideo(tx, input.videoId);
  if (input.parentId !== null && !(await isLive(tx, input.parentId))) return null;

  const now = new Date();
  const { moderation, moderators = [], ...fields } = input;
  await tx.insert(c).values({
    ...fields,
    ...(moderation ?? PUBLISHED_AT_CREATION),
    createdAt: now,
    updatedAt: now,
  });
  const counted = await isCounted(tx, input.id);
  if (counted) {
    await tx
      .update(v)
      .set({ commentsCount: sql`${v.commentsCount} + 1` })
      .where(eq(v.id, input.videoId));
  }
  const created = await threadById(tx, input.id, { id: input.authorId });
  if (counted && created && video) await publish(tx, created, video);
  if (created && moderation?.moderationState === 'held') {
    for (const userId of moderators) {
      if (userId !== input.authorId) await appendUserEvent(tx, { userId, ...commentHeld(created) });
    }
  }
  return created;
}

/** A root takes its replies with it; a held or hidden item was never counted, so it never decrements. */
export async function removeComment(
  tx: PostgresDatabase,
  target: CommentLocator,
  record?: ModerationRecord & { removal?: NewCommentRemoval }
): Promise<number> {
  await lockVideo(tx, target.videoId);
  const taken = and(
    eq(c.videoId, target.videoId),
    or(eq(c.id, target.id), eq(c.parentId, target.id))
  );
  const counted = await countedAmong(tx, taken);
  const removed = await tx
    .update(c)
    .set({ deletedAt: new Date(), isPinned: false })
    .where(drizzleWhere(taken, notDeletedScope(c)))
    .returning({ id: c.id });
  if (counted > 0) {
    await tx
      .update(v)
      .set({ commentsCount: sql`${v.commentsCount} - ${counted}` })
      .where(eq(v.id, target.videoId));
  }
  if (removed.length > 0 && record) {
    if (record.removal)
      await tx.insert(commentRemovals).values(record.removal).onConflictDoNothing();
    await appendModerationRecord(tx, record);
  }
  return removed.length;
}

export async function pinComment(
  tx: PostgresDatabase,
  target: CommentLocator,
  pinned: boolean,
  audit?: NewChannelAuditEntry
): Promise<CommentThread | null> {
  await lockVideo(tx, target.videoId);
  if (!(await isLive(tx, target.id))) return null;
  if (pinned) {
    await tx
      .update(c)
      .set({ isPinned: false })
      .where(and(eq(c.videoId, target.videoId), eq(c.isPinned, true), ne(c.id, target.id)));
  }
  const [updated] = await tx
    .update(c)
    .set({ isPinned: pinned, updatedAt: new Date() })
    .where(drizzleWhere(eq(c.id, target.id), notDeletedScope(c)))
    .returning({ id: c.id });
  if (!updated) return null;
  if (audit) await appendChannelAudit(tx, audit);
  return threadById(tx, target.id, null);
}
