import type { QueueUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import type { HealthCheckable } from './health-checkable';

export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  opts?: QueueJobOptions;
  attemptsMade?: number;
  /** When the job was added, epoch milliseconds, as the queue recorded it. */
  enqueuedAt?: number;
  updateProgress?: (progress: number | object) => Promise<void>;
  getChildrenValues?: <R = Record<string, unknown>>() => Promise<R>;
  getState?: () => Promise<string>;
}

export interface QueueJobOptions {
  jobId?: string;
  attempts?: number;
  priority?: number;
  backoff?: unknown;
  removeOnComplete?: unknown;
  removeOnFail?: unknown;
}

/**
 * The states a queue is counted in. BullMQ keeps a job with a priority in `prioritized`, not
 * `waiting`, and every pipeline job carries one, so a depth that leaves it out reads an idle queue.
 */
export const QUEUE_JOB_STATES = [
  'waiting',
  'prioritized',
  'active',
  'completed',
  'failed',
  'delayed',
] as const;
type QueueJobState = (typeof QUEUE_JOB_STATES)[number];

export type QueueJobCounts = Record<QueueJobState, number>;

export interface QueueWorkerOptions {
  concurrency?: number;
  lockDurationMs?: number;
  lockRenewTimeMs?: number;
  stalledIntervalMs?: number;
  maxStalledCount?: number;
}

export interface JobSchedulerInfo<T = unknown> {
  id: string;
  name: string;
  pattern?: string;
  every?: number;
  data?: T;
}

export interface UpsertJobSchedulerOptions {
  pattern?: string;
  every?: number;
}

export interface JobSchedulerTemplate<T = unknown> {
  name?: string;
  data?: T;
  opts?: QueueJobOptions;
}

export abstract class JobQueue implements HealthCheckable<QueueUnavailable> {
  abstract checkHealth(): Promise<Result<void, QueueUnavailable>>;
  abstract getName(): string;
  abstract add<T = unknown>(
    name: string,
    data: T,
    options?: QueueJobOptions
  ): Promise<Result<QueueJob<T>, QueueUnavailable>>;
  abstract process<T = unknown>(
    handler: (job: QueueJob<T>) => Promise<unknown>,
    options?: QueueWorkerOptions
  ): Promise<Result<void, QueueUnavailable>>;
  /** An unknown job is `ok(undefined)`: absence is not a failure. */
  abstract getJobState(jobId: string): Promise<Result<string | undefined, QueueUnavailable>>;
  abstract isPaused(): Promise<Result<boolean, QueueUnavailable>>;
  abstract pause(): Promise<Result<void, QueueUnavailable>>;
  abstract resume(): Promise<Result<void, QueueUnavailable>>;
  abstract getJobCounts(): Promise<Result<QueueJobCounts, QueueUnavailable>>;
  abstract getJobs(types?: string[]): Promise<Result<QueueJob<unknown>[], QueueUnavailable>>;
  async upsertJobScheduler<T = unknown>(
    _id: string,
    _repeatOpts: UpsertJobSchedulerOptions,
    _template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    return ok(undefined);
  }
  async getJobSchedulers(): Promise<Result<JobSchedulerInfo[], QueueUnavailable>> {
    return ok([]);
  }
  abstract close(): Promise<Result<void, QueueUnavailable>>;
  onFailed?(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void;
  /** A job whose lock expired before its worker finished: it goes back to waiting, or fails. */
  onStalled?(handler: (jobId: string) => void): void;
}
