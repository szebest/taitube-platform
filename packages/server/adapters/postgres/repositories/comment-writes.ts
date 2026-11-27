import { assertNever } from '@kit/result';
import type { CommentLocator } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type CommentEditWrite,
  type CommentThread,
  commentCreated,
  commentHeld,
  type ModerationRecord,
  type NewChannelAuditEntry,
  type NewCommentInput,
  type NewCommentRemoval,
  PUBLISHED_AT_CREATION,
} from '@vp/domain';
import { commentHeldOutbox, commentOutbox } from '@vp/job-contracts';
import { type SQL, and, eq, ne, or } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { drizzleWhere, notDeletedScope, publicCommentScope } from '../scopes/index';
import { appendChannelAudit, appendModerationRecord } from './channel-audit-writes';
import {
  type LockedTarget,
  lockTarget,
  moveCommentsCount,
  onTarget,
  targetOf,
} from './comment-targets';
import { threadById } from './comment-thread-query';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { comments: c, commentRemovals } = schema;

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

/**
 * What a comment on a video that becomes public tells people: the notification job, and the
 * owner's open tabs. A comment on a post tells no one yet.
 */
export async function publish(
  tx: PostgresDatabase,
  comment: CommentThread,
  target: LockedTarget
): Promise<void> {
  switch (target.type) {
    case 'video':
      await enqueueNotificationJobs(tx, [
        commentOutbox({ videoId: comment.target.id, commentId: comment.id }),
      ]);
      if (target.ownerId !== comment.authorId) {
        await appendUserEvent(tx, {
          userId: target.ownerId,
          ...commentCreated(comment, { id: comment.target.id, title: target.title }),
        });
      }
      return;
    case 'post':
    case 'thread':
      return;
    default:
      return assertNever(target, 'LockedTarget');
  }
}

/** The moderators but the author, on their stream and through one job to their `comment.held` webhooks. */
async function tellHeld(
  tx: PostgresDatabase,
  held: CommentThread,
  moderators: readonly string[]
): Promise<void> {
  const recipients = moderators.filter((userId) => userId !== held.authorId);
  if (recipients.length === 0) return;
  for (const userId of recipients) await appendUserEvent(tx, { userId, ...commentHeld(held) });
  if (held.target.type !== 'video') return;
  await enqueueNotificationJobs(tx, [
    commentHeldOutbox({
      holdId: uuidv7(),
      commentId: held.id,
      videoId: held.target.id,
      recipients,
    }),
  ]);
}

export async function insertComment(
  tx: PostgresDatabase,
  input: NewCommentInput,
  audit?: NewChannelAuditEntry
): Promise<CommentThread | null> {
  const locked = await lockTarget(tx, input.target);
  if (!locked) return null;
  if (input.parentId !== null && !(await isLive(tx, input.parentId))) return null;

  const now = new Date();
  const { moderation, moderators = [], target, ...fields } = input;
  await tx.insert(c).values({
    ...fields,
    targetType: target.type,
    targetId: target.id,
    ...(moderation ?? PUBLISHED_AT_CREATION),
    createdAt: now,
    updatedAt: now,
  });
  const counted = await isCounted(tx, input.id);
  if (counted) await moveCommentsCount(tx, target, 1);
  const created = await threadById(tx, input.id, { id: input.authorId });
  if (counted && created) await publish(tx, created, locked);
  if (created && moderation?.moderationState === 'held') await tellHeld(tx, created, moderators);
  if (audit) await appendChannelAudit(tx, audit);
  return created;
}

export async function editComment(
  tx: PostgresDatabase,
  id: string,
  content: string,
  { looksLikeQuestion, hold }: CommentEditWrite
): Promise<CommentThread | null> {
  const [found] = await tx
    .select({ targetType: c.targetType, targetId: c.targetId, authorId: c.authorId })
    .from(c)
    .where(drizzleWhere(eq(c.id, id), notDeletedScope(c)));
  if (!found) return null;

  const target = targetOf(found);
  await lockTarget(tx, target);
  const subtree = and(onTarget(target), or(eq(c.id, id), eq(c.parentId, id)));
  const before = await countedAmong(tx, subtree);
  const [updated] = await tx
    .update(c)
    .set({
      content,
      looksLikeQuestion,
      isEdited: true,
      updatedAt: new Date(),
      ...(hold && {
        moderationState: 'held' as const,
        moderationDisclosure: hold.disclosure,
        heldReason: hold.reason,
        moderationReason: null,
        moderationNote: null,
        moderatedBy: null,
        moderatedAt: null,
        isPinned: false,
      }),
    })
    .where(drizzleWhere(eq(c.id, id), notDeletedScope(c)))
    .returning({ id: c.id });
  if (!updated) return null;

  await moveCommentsCount(tx, target, (await countedAmong(tx, subtree)) - before);

  const thread = await threadById(tx, id, { id: found.authorId });
  if (thread && hold) await tellHeld(tx, thread, hold.moderators);
  return thread;
}

/** A root takes its replies with it; a held or hidden item was never counted, so it never decrements. */
export async function removeComment(
  tx: PostgresDatabase,
  comment: CommentLocator,
  record?: ModerationRecord & { removal?: NewCommentRemoval }
): Promise<number> {
  await lockTarget(tx, comment.target);
  const taken = and(onTarget(comment.target), or(eq(c.id, comment.id), eq(c.parentId, comment.id)));
  const counted = await countedAmong(tx, taken);
  const removed = await tx
    .update(c)
    .set({ deletedAt: new Date(), isPinned: false })
    .where(drizzleWhere(taken, notDeletedScope(c)))
    .returning({ id: c.id });
  await moveCommentsCount(tx, comment.target, -counted);
  if (removed.length > 0 && record) {
    if (record.removal)
      await tx.insert(commentRemovals).values(record.removal).onConflictDoNothing();
    await appendModerationRecord(tx, record);
  }
  return removed.length;
}

export async function pinComment(
  tx: PostgresDatabase,
  comment: CommentLocator,
  pinned: boolean,
  audit?: NewChannelAuditEntry
): Promise<CommentThread | null> {
  await lockTarget(tx, comment.target);
  if (!(await isLive(tx, comment.id))) return null;
  if (pinned) {
    await tx
      .update(c)
      .set({ isPinned: false })
      .where(and(onTarget(comment.target), eq(c.isPinned, true), ne(c.id, comment.id)));
  }
  const [updated] = await tx
    .update(c)
    .set({ isPinned: pinned, updatedAt: new Date() })
    .where(drizzleWhere(eq(c.id, comment.id), notDeletedScope(c)))
    .returning({ id: c.id });
  if (!updated) return null;
  if (audit) await appendChannelAudit(tx, audit);
  return threadById(tx, comment.id, null);
}
