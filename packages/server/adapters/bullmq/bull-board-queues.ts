import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { JobQueue } from '@vp/core/ports';
import { unwrapOr } from '@vp/result';
import { BullMqJobQueue } from './bullmq-job-queue';

type BullBoardQueue = ConstructorParameters<typeof BullMQAdapter>[0];

const IDLE_COUNTS = {
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  waiting: 0,
  paused: 0,
};

/**
 * Bull Board talks to a BullMQ `Queue`, so a port backed by anything else is presented as
 * one. Counts, paused state and scheduler totals come from the port; the job rows do not,
 * because a listed job is a BullMQ job record and the port carries no such thing.
 *
 * The operator UI has no way to render a failure, so a port that cannot answer reads as an idle
 * queue rather than breaking the page.
 */
function asBullMqQueue(queue: JobQueue): BullBoardQueue {
  return {
    name: queue.getName(),
    metaValues: { version: 'bullmq' },
    isPaused: async () => unwrapOr(await queue.isPaused(), false),
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    getJobCounts: async () => unwrapOr(await queue.getJobCounts(), IDLE_COUNTS),
    getJobs: async () => [],
    getWorkers: async () => [],
    getJobSchedulersCount: async () => unwrapOr(await queue.getJobSchedulers(), []).length,
  } as unknown as BullBoardQueue;
}

export function bullBoardQueues(queues: Iterable<JobQueue>): BaseAdapter[] {
  return Array.from(queues, (queue) =>
    queue instanceof BullMqJobQueue
      ? new BullMQAdapter(queue.getRawQueue())
      : new BullMQAdapter(asBullMqQueue(queue))
  );
}
