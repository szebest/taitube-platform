import type { CommentModerationWrite, CommentModerationWritten } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, eq, or } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope } from '../scopes/index';
import { appendModerationRecord } from './channel-audit-writes';
import { lockTarget, moveCommentsCount, onTarget } from './comment-targets';
import { threadById } from './comment-thread-query';
import { countedAmong, publish } from './comment-writes';
import type { PostgresDatabase } from './types';

const { comments: c } = schema;

/**
 * The count moves by what the comment and its replies add to or take from the public total, read
 * before and after the update under the target's lock, so no step is masked by a floor.
 */
export async function moderateComment(
  tx: PostgresDatabase,
  { comment, from, outcome, moderatorId, audit, notice }: CommentModerationWrite
): Promise<CommentModerationWritten> {
  const locked = await lockTarget(tx, comment.target);
  const [row] = await tx
    .select({ state: c.moderationState, heldReason: c.heldReason })
    .from(c)
    .where(drizzleWhere(eq(c.id, comment.id), onTarget(comment.target), notDeletedScope(c)))
    .for('update');
  if (!(row && locked)) return { type: 'missing' };
  if (row.state !== from) return { type: 'stale', state: row.state };

  const subtree = and(
    onTarget(comment.target),
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
  await moveCommentsCount(tx, comment.target, (await countedAmong(tx, subtree)) - before);
  await appendModerationRecord(tx, { audit, ...(notice && { notice }) });

  const thread = await threadById(tx, comment.id, null);
  if (!thread) return { type: 'missing' };
  const firstPublication =
    outcome.state === 'published' && row.state === 'held' && row.heldReason !== null;
  if (firstPublication) await publish(tx, thread, locked);
  return { type: 'applied', thread, firstPublication };
}
