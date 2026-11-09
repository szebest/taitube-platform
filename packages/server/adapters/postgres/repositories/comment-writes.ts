import * as schema from '@vp/db';
import {
  type CommentThread,
  commentCreated,
  type NewCommentInput,
  PUBLISHED_AT_CREATION,
} from '@vp/domain';
import { commentOutbox } from '@vp/job-contracts';
import { type SQL, eq, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope, publicCommentScope } from '../scopes/index';
import { threadById } from './comment-thread-query';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { videoComments: c, videos: v } = schema;

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

export async function insertComment(
  tx: PostgresDatabase,
  input: NewCommentInput
): Promise<CommentThread | null> {
  const video = await lockVideo(tx, input.videoId);
  if (input.parentId !== null && !(await isLive(tx, input.parentId))) return null;

  const now = new Date();
  const { moderation, ...fields } = input;
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
    await enqueueNotificationJobs(tx, [
      commentOutbox({ videoId: input.videoId, commentId: input.id }),
    ]);
  }
  const created = await threadById(tx, input.id, { id: input.authorId });
  if (counted && created && video && video.ownerId !== input.authorId) {
    await appendUserEvent(tx, {
      userId: video.ownerId,
      ...commentCreated(created, { id: input.videoId, title: video.title }),
    });
  }
  return created;
}
