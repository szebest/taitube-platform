import type { QueueJob } from '@vp/core/ports';
import type { Job } from 'bullmq';

/** The shape a listener or a caller sees: a BullMQ job reduced to the port's vocabulary. */
export function toQueueJob<T = unknown>(job: Job): QueueJob<T> {
  return {
    id: job.id ?? '',
    name: job.name,
    data: job.data as T,
    opts: {
      jobId: job.id,
      attempts: job.opts?.attempts,
      priority: job.opts?.priority,
    },
    attemptsMade: job.attemptsMade,
  };
}
