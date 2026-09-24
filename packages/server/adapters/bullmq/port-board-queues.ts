import { BaseAdapter } from '@bull-board/api/dist/queueAdapters/base.js';
import type {
  AppJobScheduler,
  JobCounts,
  JobSchedulerUpdateResult,
  JobStatus,
  QueueJob,
  QueueMetrics,
  QueueWorker,
  Status,
} from '@bull-board/api/typings/app';
import type { JobQueue, QueueJobCounts } from '@vp/core/ports';
import { type Result, isErr, unwrapOr } from '@vp/result';

const IDLE_COUNTS: QueueJobCounts = {
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  waiting: 0,
  prioritized: 0,
};

const JOB_STATUSES: JobStatus[] = [
  'active',
  'waiting',
  'waiting-children',
  'prioritized',
  'completed',
  'failed',
  'delayed',
  'paused',
];

function unsupported(operation: string): never {
  throw new Error(`${operation} is not available on a queue that is not backed by BullMQ`);
}

function settle(result: Result<void, { message: string }>): void {
  if (isErr(result)) throw new Error(result.error.message);
}

/**
 * Bull Board talks to a BullMQ `Queue`, so a port backed by anything else is presented as
 * one. Counts, paused state and scheduler totals come from the port; the job rows do not,
 * because a listed job is a BullMQ job record and the port carries no such thing.
 *
 * The operator UI has no way to render a failed read, so a port that cannot answer one reads as
 * an idle queue rather than breaking the page. A failed pause or resume is thrown, which the
 * board answers with an error response.
 */
class PortBoardAdapter extends BaseAdapter {
  constructor(private readonly queue: JobQueue) {
    super('bullmq');
  }

  getName(): string {
    return `${this.prefix}${this.queue.getName()}`;
  }

  async getRedisInfo(): Promise<string | null> {
    return null;
  }

  async getJobCounts(): Promise<JobCounts> {
    const counts = unwrapOr(await this.queue.getJobCounts(), IDLE_COUNTS);
    return { latest: 0, 'waiting-children': 0, paused: 0, ...counts };
  }

  async getJobs(): Promise<QueueJob[]> {
    return [];
  }

  async getJob(): Promise<null> {
    return null;
  }

  async getJobLogs(): Promise<string[]> {
    return [];
  }

  override async getWorkers(): Promise<QueueWorker[]> {
    return [];
  }

  async isPaused(): Promise<boolean> {
    return unwrapOr(await this.queue.isPaused(), false);
  }

  async pause(): Promise<void> {
    settle(await this.queue.pause());
  }

  async resume(): Promise<void> {
    settle(await this.queue.resume());
  }

  async getJobSchedulersCount(): Promise<number> {
    return unwrapOr(await this.queue.getJobSchedulers(), []).length;
  }

  getStatuses(): Status[] {
    return ['latest', ...JOB_STATUSES];
  }

  getJobStatuses(): JobStatus[] {
    return JOB_STATUSES;
  }

  async getGlobalConcurrency(): Promise<null> {
    return null;
  }

  async clean(): Promise<void> {
    return unsupported('clean');
  }

  async addJob(): Promise<QueueJob> {
    return unsupported('addJob');
  }

  async getMetrics(): Promise<QueueMetrics> {
    return unsupported('getMetrics');
  }

  async empty(): Promise<void> {
    return unsupported('empty');
  }

  async obliterate(): Promise<void> {
    return unsupported('obliterate');
  }

  async promoteAll(): Promise<void> {
    return unsupported('promoteAll');
  }

  async removeJobScheduler(): Promise<boolean> {
    return unsupported('removeJobScheduler');
  }

  async getJobSchedulers(): Promise<Omit<AppJobScheduler, 'queueName'>[]> {
    return unsupported('getJobSchedulers');
  }

  async updateJobScheduler(): Promise<JobSchedulerUpdateResult> {
    return unsupported('updateJobScheduler');
  }

  async runJobSchedulerNow(): Promise<QueueJob | 'not-found'> {
    return unsupported('runJobSchedulerNow');
  }

  async setGlobalConcurrency(): Promise<void> {
    return unsupported('setGlobalConcurrency');
  }
}

export function portBoardQueue(queue: JobQueue): BaseAdapter {
  return new PortBoardAdapter(queue);
}

export function portBoardQueues(queues: Iterable<JobQueue>): BaseAdapter[] {
  return Array.from(queues, portBoardQueue);
}
