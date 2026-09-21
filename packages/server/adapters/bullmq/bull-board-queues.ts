import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { JobQueue } from '@vp/core/ports';
import { BullMqJobQueue } from './bullmq-job-queue';

type BullBoardQueue = ConstructorParameters<typeof BullMQAdapter>[0];

/**
 * Bull Board talks to a BullMQ `Queue`, so a port backed by anything else is presented as
 * one. Counts, paused state and scheduler totals come from the port; the job rows do not,
 * because a listed job is a BullMQ job record and the port carries no such thing.
 */
function asBullMqQueue(queue: JobQueue): BullBoardQueue {
  return {
    name: queue.getName(),
    metaValues: { version: 'bullmq' },
    isPaused: () => queue.isPaused(),
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    getJobCounts: () => queue.getJobCounts(),
    getJobs: async () => [],
    getWorkers: async () => [],
    getJobSchedulersCount: async () => (await queue.getJobSchedulers()).length,
  } as unknown as BullBoardQueue;
}

export function bullBoardQueues(queues: Iterable<JobQueue>): BaseAdapter[] {
  return Array.from(queues, (queue) =>
    queue instanceof BullMqJobQueue
      ? new BullMQAdapter(queue.getRawQueue())
      : new BullMQAdapter(asBullMqQueue(queue))
  );
}
