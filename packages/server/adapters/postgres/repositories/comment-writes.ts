import * as schema from '@vp/db';
import { type CommentThread, commentCreated, type NewCommentInput } from '@vp/domain';
import { commentOutbox } from '@vp/job-contracts';
import { eq, sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
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

export async function insertComment(
  tx: PostgresDatabase,
  input: NewCommentInput
): Promise<CommentThread | null> {
  const video = await lockVideo(tx, input.videoId);
  if (input.parentId !== null && !(await isLive(tx, input.parentId))) return null;

  const now = new Date();
  await tx.insert(c).values({ ...input, createdAt: now, updatedAt: now });
  await tx
    .update(v)
    .set({ commentsCount: sql`${v.commentsCount} + 1` })
    .where(eq(v.id, input.videoId));
  await enqueueNotificationJobs(tx, [
    commentOutbox({ videoId: input.videoId, commentId: input.id }),
  ]);
  const created = await threadById(tx, input.id);
  if (created && video && video.ownerId !== input.authorId) {
    await appendUserEvent(tx, {
      userId: video.ownerId,
      ...commentCreated(created, { id: input.videoId, title: video.title }),
    });
  }
  return created;
}
