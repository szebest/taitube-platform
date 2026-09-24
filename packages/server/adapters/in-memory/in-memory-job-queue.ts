import { JOB_PRIORITY } from '@vp/domain';
import {
  JobQueue,
  type JobSchedulerInfo,
  type JobSchedulerTemplate,
  type QueueJob,
  type QueueJobCounts,
  type QueueJobOptions,
  type QueueWorkerOptions,
  type UpsertJobSchedulerOptions,
} from '@vp/core/ports';
import { type QueueUnavailable, classifyError, queueUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';

export class InMemoryJobQueue extends JobQueue {
  private readonly name: string;
  private paused = false;
  private isHealthy = true;
  private processor?: (job: QueueJob<unknown>) => Promise<unknown>;
  private failedHandler?: (job: QueueJob<unknown>, err: Error) => Promise<void> | void;
  private readonly allJobs = new Map<string, QueueJob<unknown>>();
  private readonly jobStates = new Map<string, string>();
  private readonly schedulers = new Map<string, JobSchedulerInfo>();
  readonly enqueuedJobs: QueueJob<unknown>[] = [];
  readonly completedJobs: QueueJob<unknown>[] = [];
  readonly failedJobs: { job: QueueJob<unknown>; error: unknown }[] = [];

  constructor(name = 'default') {
    super();
    this.name = name;
  }

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    return this.isHealthy ? ok() : err(queueUnavailable('checkHealth'));
  }

  getName(): string {
    return this.name;
  }

  async getJobState(jobId: string): Promise<Result<string | undefined, QueueUnavailable>> {
    return ok(this.jobStates.get(jobId));
  }

  setJobState(jobId: string, state: string): void {
    this.jobStates.set(jobId, state);
  }

  onFailed(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void {
    this.failedHandler = handler;
  }

  private getJobPriority(job: QueueJob<unknown>): number {
    const opts = (job as QueueJob<unknown> & { opts?: QueueJobOptions }).opts;
    return opts?.priority ?? JOB_PRIORITY.free;
  }

  enqueueWaiting(job: QueueJob<unknown>): void {
    this.jobStates.set(job.id, 'waiting');
    const priority = this.getJobPriority(job);
    const index = this.enqueuedJobs.findIndex((j) => this.getJobPriority(j) > priority);
    if (index === -1) {
      this.enqueuedJobs.push(job);
    } else {
      this.enqueuedJobs.splice(index, 0, job);
    }
  }

  async add<T = unknown>(
    name: string,
    data: T,
    options?: QueueJobOptions & { initialState?: string }
  ): Promise<Result<QueueJob<T>, QueueUnavailable>> {
    const jobId = options?.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // BullMQ deduplication: if job exists in any non-removed state, return existing job
    const existing = this.allJobs.get(jobId);
    if (existing) {
      return ok(existing as QueueJob<T>);
    }

    const job: QueueJob<T> & { opts?: QueueJobOptions } = {
      id: jobId,
      name,
      data,
      attemptsMade: 0,
      opts: options,
      getState: async () => this.jobStates.get(jobId) ?? 'unknown',
    };

    const initialState = options?.initialState ?? 'waiting';
    this.allJobs.set(jobId, job);
    this.jobStates.set(jobId, initialState);

    if (initialState === 'waiting') {
      this.enqueueWaiting(job);
      // If a worker is listening and we are not paused, execute
      if (this.processor && !this.paused) {
        queueMicrotask(() => {
          this.drain().catch(() => {});
        });
      }
    }

    return ok(job);
  }

  private readonly jobCompletedListeners: ((job: QueueJob<unknown>, result: unknown) => void)[] =
    [];
  private readonly jobFailedListeners: ((job: QueueJob<unknown>, error: Error) => void)[] = [];

  onJobCompleted(listener: (job: QueueJob<unknown>, result: unknown) => void): void {
    this.jobCompletedListeners.push(listener);
  }

  onJobFailed(listener: (job: QueueJob<unknown>, error: Error) => void): void {
    this.jobFailedListeners.push(listener);
  }

  async executeJob(job: QueueJob<unknown>): Promise<void> {
    const currentState = this.jobStates.get(job.id);
    if (currentState === 'waiting-children') {
      // Still waiting for children to finish
      return;
    }

    const index = this.enqueuedJobs.indexOf(job);
    if (index !== -1) {
      this.enqueuedJobs.splice(index, 1);
    }

    this.jobStates.set(job.id, 'active');
    job.attemptsMade = (job.attemptsMade ?? 0) + 1;

    if (!this.processor) return;

    try {
      const result = await this.processor(job);
      this.jobStates.set(job.id, 'completed');
      this.completedJobs.push(job);
      for (const listener of this.jobCompletedListeners) {
        try {
          listener(job, result);
        } catch {}
      }
      return;
    } catch (err: unknown) {
      const classification = classifyError(err);
      const opts = (job as QueueJob<unknown> & { opts?: QueueJobOptions }).opts;
      let maxAttempts = opts?.attempts ?? 1;
      if (classification === 'permanent') {
        maxAttempts = 1;
      } else if (classification === 'unknown') {
        // ADR-18: retry an unrecognised error a little, then park it.
        maxAttempts = Math.min(maxAttempts, 3);
      }

      if ((job.attemptsMade ?? 1) < maxAttempts) {
        this.jobStates.set(job.id, 'delayed');
        this.enqueueWaiting(job);
        if (!this.paused) {
          await this.executeJob(job);
        }
        return;
      }

      this.jobStates.set(job.id, 'failed');
      this.failedJobs.push({ job, error: err });
      for (const listener of this.jobFailedListeners) {
        try {
          listener(job, err as Error);
        } catch {}
      }
      if (this.failedHandler) {
        try {
          await this.failedHandler(job, err as Error);
        } catch {}
      }
      throw err;
    }
  }

  async failJob(jobId: string, err: Error): Promise<void> {
    const job = this.allJobs.get(jobId);
    if (!job) return;
    const index = this.enqueuedJobs.indexOf(job);
    if (index !== -1) {
      this.enqueuedJobs.splice(index, 1);
    }
    job.attemptsMade = job.attemptsMade || 1;
    this.jobStates.set(jobId, 'failed');
    this.failedJobs.push({ job, error: err });
    if (this.failedHandler) {
      try {
        await this.failedHandler(job, err);
      } catch {}
    }
  }

  async process<T = unknown>(
    handler: (job: QueueJob<T>) => Promise<unknown>,
    _options?: QueueWorkerOptions
  ): Promise<Result<void, QueueUnavailable>> {
    this.processor = handler as (job: QueueJob<unknown>) => Promise<unknown>;
    // Process pending jobs if not paused
    if (!this.paused) {
      await this.drain();
    }
    return ok();
  }

  private isDraining = false;

  async drain(): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;
    let firstError: Error | undefined;
    try {
      while (!this.paused && this.processor) {
        const nextIndex = this.enqueuedJobs.findIndex(
          (job) => this.jobStates.get(job.id) === 'waiting'
        );
        if (nextIndex === -1) break;
        const job = this.enqueuedJobs[nextIndex];
        if (!job) break;
        try {
          await this.executeJob(job);
        } catch (err: unknown) {
          if (!firstError) {
            firstError = err as Error;
          }
        }
      }
    } finally {
      this.isDraining = false;
      if (
        !this.paused &&
        this.processor &&
        this.enqueuedJobs.some((job) => this.jobStates.get(job.id) === 'waiting')
      ) {
        queueMicrotask(() => {
          this.drain().catch(() => {});
        });
      }
    }

    if (firstError) {
      throw firstError;
    }
  }

  async isPaused(): Promise<Result<boolean, QueueUnavailable>> {
    return ok(this.paused);
  }

  async pause(): Promise<Result<void, QueueUnavailable>> {
    this.paused = true;
    return ok();
  }

  async resume(): Promise<Result<void, QueueUnavailable>> {
    this.paused = false;
    if (this.processor && !this.isDraining) {
      queueMicrotask(() => {
        this.drain().catch(() => {});
      });
    }
    return ok();
  }

  async getJobCounts(): Promise<Result<QueueJobCounts, QueueUnavailable>> {
    return ok({
      waiting: this.enqueuedJobs.length,
      active: Array.from(this.jobStates.values()).filter((s) => s === 'active').length,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      delayed: 0,
      paused: this.paused ? this.enqueuedJobs.length : 0,
    });
  }

  async getJobs(
    types: string[] = ['waiting']
  ): Promise<Result<QueueJob<unknown>[], QueueUnavailable>> {
    const result: QueueJob<unknown>[] = [];
    if (
      types.includes('waiting') ||
      types.includes('prioritized') ||
      types.includes('delayed') ||
      (this.paused && types.includes('paused'))
    ) {
      result.push(...this.enqueuedJobs);
    }
    if (types.includes('completed')) {
      result.push(...this.completedJobs);
    }
    if (types.includes('failed')) {
      result.push(...this.failedJobs.map((f) => f.job));
    }
    return ok(result);
  }

  override async upsertJobScheduler<T = unknown>(
    id: string,
    repeatOpts: UpsertJobSchedulerOptions,
    template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    const scheduler: JobSchedulerInfo = {
      id,
      name: template?.name ?? id,
      pattern: repeatOpts.pattern,
      every: repeatOpts.every,
      data: template?.data,
    };
    this.schedulers.set(id, scheduler);
    return ok(scheduler);
  }

  override async getJobSchedulers(): Promise<Result<JobSchedulerInfo[], QueueUnavailable>> {
    return ok(Array.from(this.schedulers.values()));
  }

  clear(): void {
    this.isDraining = false;
    this.allJobs.clear();
    this.jobStates.clear();
    this.enqueuedJobs.length = 0;
    this.completedJobs.length = 0;
    this.failedJobs.length = 0;
    this.schedulers.clear();
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    this.processor = undefined;
    this.isDraining = false;
    return ok();
  }
}
