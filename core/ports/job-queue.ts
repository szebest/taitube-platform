import type { HealthCheckable } from './health-checkable.js';

export class QueueError extends Error {
  readonly code?: string;
  override readonly cause?: unknown;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'QueueError';
    this.code = options?.code;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  attemptsMade?: number;
  updateProgress?: (progress: number | object) => Promise<void>;
  getChildrenValues?: <R = Record<string, unknown>>() => Promise<R>;
  getState?: () => Promise<string>;
}

export interface QueueJobOptions {
  jobId?: string;
  attempts?: number;
  backoff?: unknown;
  removeOnComplete?: unknown;
  removeOnFail?: unknown;
}

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueWorkerOptions {
  concurrency?: number;
  lockDurationMs?: number;
  lockRenewTimeMs?: number;
  stalledIntervalMs?: number;
  maxStalledCount?: number;
}

export abstract class JobQueue implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract getName(): string;
  abstract add<T = unknown>(name: string, data: T, options?: QueueJobOptions): Promise<QueueJob<T>>;
  abstract process<T = unknown>(
    handler: (job: QueueJob<T>) => Promise<unknown>,
    options?: QueueWorkerOptions
  ): Promise<void>;
  abstract getJobState(jobId: string): Promise<string | undefined>;
  abstract isPaused(): Promise<boolean>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract getJobCounts(): Promise<QueueJobCounts>;
  abstract getJobs(types?: string[]): Promise<QueueJob<unknown>[]>;
  abstract close(): Promise<void>;
  onFailed?(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void;
}
