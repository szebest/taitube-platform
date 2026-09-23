import type { JobQueue } from '@vp/core/ports';
import type { QueueUnavailable } from '@vp/errors';
import { type Result, all, map } from '@vp/result';

export interface QueueRegistry {
  get(name: string): JobQueue;
  close(): Promise<Result<void, QueueUnavailable>>;
}

/** A queue the composition needs and the map lacks is a wiring error, raised at compose time. */
export function queueNamed(queues: ReadonlyMap<string, JobQueue>, name: string): JobQueue {
  const queue = queues.get(name);
  if (!queue) throw new Error(`No queue named ${name}`);
  return queue;
}

/** Opens a queue on first use, so a worker holds a connection only for the queues it touches. */
export class LazyQueueRegistry implements QueueRegistry {
  private readonly opened = new Map<string, JobQueue>();

  constructor(private readonly open: (name: string) => JobQueue) {}

  get(name: string): JobQueue {
    const existing = this.opened.get(name);
    if (existing) return existing;

    const queue = this.open(name);
    this.opened.set(name, queue);
    return queue;
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    const closed = await Promise.all([...this.opened.values()].map((queue) => queue.close()));
    return map(all(closed), () => undefined);
  }
}
