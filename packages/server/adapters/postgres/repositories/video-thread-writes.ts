import type {
  ThreadModerated,
  ThreadModerationWrite,
  ThreadRemovalRecord,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type NewChannelAuditEntry,
  type NewVideoThreadInput,
  type ThreadCreated,
  type ThreadPinOutcome,
  commentHeld,
  keepsPin,
} from '@vp/domain';
import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { appendChannelAudit, appendModerationRecord } from './channel-audit-writes';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';
import { toVideoThread } from './video-thread-queries';

const { videoThreads: t, commentRemovals } = schema;

const lockVideo = (tx: PostgresDatabase, videoId: string) =>
  tx.execute(sql`select id from videos where id = ${videoId}::uuid for update`);

/** Counts the author's threads on the video under a lock on the video row, so the last slot goes once. */
export async function createThreadWithinLimit(
  tx: PostgresDatabase,
  input: NewVideoThreadInput,
  openLimit: number
): Promise<ThreadCreated> {
  await lockVideo(tx, input.videoId);
  const [open] = await tx
    .select({ total: count() })
    .from(t)
    .where(and(eq(t.videoId, input.videoId), eq(t.authorId, input.authorId), isNull(t.deletedAt)));
  if ((open?.total ?? 0) >= openLimit) return { type: 'limit' };

  const { moderation, moderators = [], ...fields } = input;
  const [row] = await tx
    .insert(t)
    .values({ ...fields, ...moderation, createdAt: new Date() })
    .returning();
  if (!row) throw new Error('video thread insert returned no row');
  if (moderation.moderationState === 'held') {
    const held = commentHeld({ id: row.id, target: { type: 'thread', id: row.id } });
    for (const userId of moderators.filter((id) => id !== input.authorId)) {
      await appendUserEvent(tx, { userId, ...held });
    }
  }
  return { type: 'created', thread: toVideoThread(row) };
}

/** Compare and set on `moderation_state`; a thread that leaves public reads loses its pin. */
export async function moderateThreadRow(
  tx: PostgresDatabase,
  { id, from, outcome, audit, notice }: ThreadModerationWrite
): Promise<ThreadModerated> {
  const [row] = await tx
    .select({ state: t.moderationState })
    .from(t)
    .where(and(eq(t.id, id), isNull(t.deletedAt)))
    .for('update');
  if (!row) return { type: 'missing' };
  if (row.state !== from) return { type: 'stale', state: row.state };

  const [updated] = await tx
    .update(t)
    .set({
      moderationState: outcome.state,
      moderationDisclosure: outcome.disclosure,
      heldReason: null,
      ...(keepsPin(outcome.state) ? {} : { pinnedAt: null }),
    })
    .where(eq(t.id, id))
    .returning();
  if (!updated) return { type: 'missing' };
  await appendModerationRecord(tx, { audit, ...(notice && { notice }) });
  return { type: 'applied', thread: toVideoThread(updated) };
}

export async function setThreadPinned(
  tx: PostgresDatabase,
  args: { id: string; pinned: boolean; limit: number },
  audit: NewChannelAuditEntry
): Promise<ThreadPinOutcome> {
  const { id, pinned, limit } = args;
  const [found] = await tx.select({ videoId: t.videoId }).from(t).where(eq(t.id, id));
  if (!found) return 'missing';
  await lockVideo(tx, found.videoId);

  const [thread] = await tx
    .select({ pinnedAt: t.pinnedAt })
    .from(t)
    .where(and(eq(t.id, id), isNull(t.deletedAt)));
  if (!thread) return 'missing';
  if (pinned === (thread.pinnedAt !== null)) return pinned ? 'pinned' : 'unpinned';
  if (pinned) {
    const [held] = await tx
      .select({ total: count() })
      .from(t)
      .where(and(eq(t.videoId, found.videoId), isNotNull(t.pinnedAt), isNull(t.deletedAt)));
    if ((held?.total ?? 0) >= limit) return 'limit';
  }
  await tx
    .update(t)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(eq(t.id, id));
  await appendChannelAudit(tx, audit);
  return pinned ? 'pinned' : 'unpinned';
}

/** The row goes, and the trigger that follows every target takes its comments with it. */
export async function removeThreadRow(
  tx: PostgresDatabase,
  id: string,
  record: ThreadRemovalRecord
): Promise<boolean> {
  const removed = await tx.delete(t).where(eq(t.id, id)).returning({ id: t.id });
  if (removed.length === 0) return false;
  if (record.removal) {
    await tx.insert(commentRemovals).values(record.removal).onConflictDoNothing();
  }
  await appendModerationRecord(tx, {
    audit: record.audit,
    ...(record.notice && { notice: record.notice }),
  });
  return true;
}
