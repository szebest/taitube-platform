import type { CommentModerationWrite, CommentModerationWritten } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, eq, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
import { appendModerationRecord } from './channel-audit-writes';
import { threadById } from './comment-thread-query';
import { countedAmong, lockVideo, publish } from './comment-writes';
import type { PostgresDatabase } from './types';

const { videoComments: c, videos: v } = schema;

/**
 * The count moves by what the comment and its replies add to or take from the public total, read
 * before and after the update under the video's lock, so no step is masked by a floor.
 */
export async function moderateComment(
  tx: PostgresDatabase,
  { comment, from, outcome, moderatorId, audit, notice }: CommentModerationWrite
): Promise<CommentModerationWritten> {
  const video = await lockVideo(tx, comment.videoId);
  const [row] = await tx
    .select({ state: c.moderationState, heldReason: c.heldReason })
    .from(c)
    .where(drizzleWhere(eq(c.id, comment.id), eq(c.videoId, comment.videoId), notDeletedScope(c)))
    .for('update');
  if (!(row && video)) return { type: 'missing' };
  if (row.state !== from) return { type: 'stale', state: row.state };

  const subtree = and(
    eq(c.videoId, comment.videoId),
    or(eq(c.id, comment.id), eq(c.parentId, comment.id))
  );
  const before = await countedAmong(tx, subtree);
  const now = new Date();
  await tx
    .update(c)
    .set({
      moderationState: outcome.state,
      moderationDisclosure: outcome.disclosure,
      moderationReason: outcome.reason,
      moderationNote: outcome.note,
      moderatedBy: moderatorId,
      moderatedAt: now,
      heldReason: null,
      ...(outcome.state === 'published' ? {} : { isPinned: false }),
    })
    .where(eq(c.id, comment.id));
  const after = await countedAmong(tx, subtree);
  if (after !== before) {
    await tx
      .update(v)
      .set({ commentsCount: sql`${v.commentsCount} + ${after - before}` })
      .where(eq(v.id, comment.videoId));
  }
  await appendModerationRecord(tx, { audit, ...(notice && { notice }) });

  const thread = await threadById(tx, comment.id, null);
  if (!thread) return { type: 'missing' };
  const firstPublication =
    outcome.state === 'published' && row.state === 'held' && row.heldReason !== null;
  if (firstPublication) await publish(tx, thread, video);
  return { type: 'applied', thread, firstPublication };
}
