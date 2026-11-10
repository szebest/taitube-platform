import { trace } from '@opentelemetry/api';
import type { TransitionVideoOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { videoStatusChanged } from '@vp/domain';
import { transitionNotificationJobs } from '@vp/job-contracts';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase, VideoInsert } from './types';

const { videos: v, videoEvents: ve } = schema;

/**
 * The compare-and-set every status change is: the update only lands while the status is still one of
 * `from`, and the event row, the owner's user event and any outbox rows commit with it. Runs on the
 * caller's transaction, so a repository that changes more than the video commits it all or nothing.
 * `false` when the video was not in `from`, or is gone.
 */
export async function commitVideoTransition(
  tx: PostgresDatabase,
  options: TransitionVideoOptions
): Promise<boolean> {
  const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;
  const effectiveTraceId = traceId || trace.getActiveSpan()?.spanContext().traceId || null;
  const statusCond = Array.isArray(from) ? inArray(v.status, from) : eq(v.status, from);

  const rows = await tx
    .update(v)
    .set({
      ...patch,
      status: to,
      updatedAt: new Date(),
      ...(to === 'READY' ? { readyAt: new Date() } : {}),
    } as VideoInsert)
    .where(and(eq(v.id, videoId), statusCond))
    .returning({ ownerId: v.ownerId, visibility: v.visibility });

  const [owner] = rows;
  if (!owner) return false;

  await tx.insert(ve).values({
    videoId,
    type: eventType || `video.${to.toLowerCase()}`,
    payload: eventPayload,
    traceId: effectiveTraceId,
    createdAt: new Date(),
  });

  if (options.outbox) {
    await tx.insert(schema.outbox).values({
      id: options.outbox.id || sql`gen_random_uuid()`,
      kind: options.outbox.kind,
      payload: options.outbox.payload,
      createdAt: new Date(),
      attempts: 0,
    });
  }

  await appendUserEvent(tx, {
    userId: owner.ownerId,
    ...videoStatusChanged(videoId, to),
  });
  await enqueueNotificationJobs(
    tx,
    transitionNotificationJobs(videoId, from, to, owner.visibility)
  );

  return true;
}
