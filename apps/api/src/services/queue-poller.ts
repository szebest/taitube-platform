import { type JobQueue, QUEUE_JOB_STATES } from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { isOk } from '@vp/result';

/** BullMQ stamps a job with `timestamp`; the port shape does not carry it, so it is read defensively. */
function oldestWaitingAgeSeconds(waiting: readonly unknown[]): number {
  const oldest = waiting[0];
  if (!oldest) return 0;

  const enqueuedAt = (oldest as { timestamp?: number }).timestamp ?? Date.now();
  return Math.max(0, (Date.now() - enqueuedAt) / MS_PER_SECOND);
}

/**
 * Writes `bullmq_queue_jobs{queue, state}` and `bullmq_queue_oldest_waiting_age_seconds{queue}`.
 * One unreachable queue costs its own sample, not the others'.
 */
export async function pollQueueMetrics(
  queues: ReadonlyMap<string, JobQueue>,
  metrics: PipelineMetrics
): Promise<void> {
  for (const [name, queue] of queues) {
    const counts = await queue.getJobCounts();
    if (isOk(counts)) {
      for (const state of QUEUE_JOB_STATES) {
        metrics.bullmqQueueJobs.set({ queue: name, state }, counts.value[state]);
      }
    }

    const waiting = await queue.getJobs(['waiting']);
    metrics.bullmqQueueOldestWaitingAge.set(
      { queue: name },
      isOk(waiting) ? oldestWaitingAgeSeconds(waiting.value) : 0
    );
  }
}
