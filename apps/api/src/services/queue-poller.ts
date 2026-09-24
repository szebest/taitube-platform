import { type JobQueue, QUEUE_JOB_STATES, type QueueJob } from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { PipelineMetrics } from '@vp/observability';
import { isOk } from '@vp/result';

/** A pipeline job has a priority, so BullMQ keeps it in `prioritized`; both hold jobs not started. */
const NOT_STARTED = ['waiting', 'prioritized'];

function oldestAgeSeconds(jobs: readonly QueueJob[], now: number): number {
  let oldest = now;
  for (const job of jobs) {
    if (job.enqueuedAt !== undefined && job.enqueuedAt < oldest) oldest = job.enqueuedAt;
  }
  return Math.max(0, (now - oldest) / MS_PER_SECOND);
}

/**
 * Writes `bullmq_queue_jobs{queue, state}` and `bullmq_queue_oldest_waiting_age_seconds{queue}`.
 * One unreachable queue costs its own sample, not the others'.
 */
export async function pollQueueMetrics(
  queues: ReadonlyMap<string, JobQueue>,
  metrics: PipelineMetrics,
  now: () => number
): Promise<void> {
  for (const [name, queue] of queues) {
    const counts = await queue.getJobCounts();
    if (isOk(counts)) {
      for (const state of QUEUE_JOB_STATES) {
        metrics.bullmqQueueJobs.set({ queue: name, state }, counts.value[state]);
      }
    }

    const notStarted = await queue.getJobs(NOT_STARTED);
    const age = isOk(notStarted) ? oldestAgeSeconds(notStarted.value, now()) : 0;
    metrics.bullmqQueueOldestWaitingAge.set({ queue: name }, age);
  }
}
