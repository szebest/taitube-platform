import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { JobQueue } from '@vp/core/ports';
import { BullMqJobQueue } from './bullmq-job-queue';
import { portBoardQueue } from './port-board-queues';

/** A BullMQ-backed queue hands Bull Board its own `Queue`; any other port is presented as one. */
export function bullBoardQueues(queues: Iterable<JobQueue>): BaseAdapter[] {
  return Array.from(queues, (queue) =>
    queue instanceof BullMqJobQueue ? new BullMQAdapter(queue.getRawQueue()) : portBoardQueue(queue)
  );
}
