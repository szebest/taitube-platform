import { trace } from '@opentelemetry/api';
import type { TransitionVideoOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { resolveVideoTransition, videoStatusChanged } from '@vp/domain';
import { transitionNotificationJobs } from '@vp/job-contracts';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase, VideoInsert } from './types';

const { videos: v, videoEvents: ve } = schema;

/**
 * The compare-and-set every status change is: the update only lands while the status is still one of
 * the edge's sources, and the event row, the owner's user event and any outbox rows commit with it.
 * Runs on the caller's transaction, so a repository that changes more than the video commits it all
 * or nothing. `false` when the video was in none of them, or is gone.
 */
export async function commitVideoTransition(
  tx: PostgresDatabase,
  options: TransitionVideoOptions
): Promise<boolean> {
  const { videoId, generation, patch = {}, eventPayload = {}, traceId } = options;
  const { edge, from, to, event } = resolveVideoTransition(options);
  const effectiveTraceId = traceId || trace.getActiveSpan()?.spanContext().traceId || null;

  const rows = await tx
    .update(v)
    .set({
      ...patch,
      status: to,
      updatedAt: new Date(),
      ...(to === 'READY' ? { readyAt: new Date() } : {}),
    } as VideoInsert)
    .where(
      and(
        eq(v.id, videoId),
        inArray(v.status, [...from]),
        generation === undefined ? undefined : eq(v.generation, generation)
      )
    )
    .returning({ ownerId: v.ownerId, visibility: v.visibility });

  const [owner] = rows;
  if (!owner) return false;

  await tx.insert(ve).values({
    videoId,
    type: event || `video.${to.toLowerCase()}`,
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
  if (edge) {
    await enqueueNotificationJobs(tx, transitionNotificationJobs(videoId, edge, owner.visibility));
  }

  return true;
}
