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
  readonly metaValues = { version: 'bullmq' };
  readonly opts = { prefix: 'bull' };

  constructor(name = 'default') {
    super();
    this.name = name;
  }

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<boolean> {
    return this.isHealthy;
  }

  getName(): string {
    return this.name;
  }

  async getJobState(jobId: string): Promise<string | undefined> {
    return this.jobStates.get(jobId);
  }

  setJobState(jobId: string, state: string): void {
    this.jobStates.set(jobId, state);
  }

  onFailed(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void {
    this.failedHandler = handler;
  }

  async add<T = unknown>(
    name: string,
    data: T,
    options?: QueueJobOptions & { initialState?: string }
  ): Promise<QueueJob<T>> {
    const jobId = options?.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // BullMQ deduplication: if job exists in any non-removed state, return existing job
    const existing = this.allJobs.get(jobId);
    if (existing) {
      return existing as QueueJob<T>;
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
      this.enqueuedJobs.push(job);
      // If a worker is listening and we are not paused, execute
      if (this.processor && !this.paused) {
        queueMicrotask(() => {
          this.executeJob(job).catch(() => {});
        });
      }
    }

    return job;
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
      const isPermanent =
        (err as { isRetryable?: boolean }).isRetryable === false ||
        (err as Error).name === 'UnrecoverableError';
      const isTransient = (err as { isRetryable?: boolean }).isRetryable === true;
      const opts = (job as QueueJob<unknown> & { opts?: QueueJobOptions }).opts;
      let maxAttempts = opts?.attempts ?? 1;
      if (isPermanent) {
        maxAttempts = 1;
      } else if (!isTransient) {
        // Unknown errors treated as transient with cap 3 (AC 2)
        maxAttempts = Math.min(maxAttempts, 3);
      }

      if ((job.attemptsMade ?? 1) < maxAttempts) {
        this.jobStates.set(job.id, 'delayed');
        this.enqueuedJobs.push(job);
        this.jobStates.set(job.id, 'waiting');
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
  ): Promise<void> {
    this.processor = handler as (job: QueueJob<unknown>) => Promise<unknown>;
    // Process pending jobs if not paused
    if (!this.paused) {
      await this.drain();
    }
  }

  async drain(): Promise<void> {
    const pending = [...this.enqueuedJobs];
    for (const job of pending) {
      if (this.jobStates.get(job.id) === 'waiting') {
        await this.executeJob(job);
      }
    }
  }

  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
    if (this.processor) {
      await this.drain();
    }
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    return {
      waiting: this.enqueuedJobs.length,
      active: Array.from(this.jobStates.values()).filter((s) => s === 'active').length,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      delayed: 0,
      paused: this.paused ? this.enqueuedJobs.length : 0,
    };
  }

  async getJobs(types: string[] = ['waiting']): Promise<QueueJob<unknown>[]> {
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
    return result;
  }

  async upsertJobScheduler<T = unknown>(
    id: string,
    repeatOpts: UpsertJobSchedulerOptions,
    template?: JobSchedulerTemplate<T>
  ): Promise<unknown> {
    const scheduler: JobSchedulerInfo = {
      id,
      name: template?.name ?? id,
      pattern: repeatOpts.pattern,
      every: repeatOpts.every,
      data: template?.data,
    };
    this.schedulers.set(id, scheduler);
    return scheduler;
  }

  async getJobSchedulers(): Promise<JobSchedulerInfo[]> {
    return Array.from(this.schedulers.values());
  }

  clear(): void {
    this.allJobs.clear();
    this.jobStates.clear();
    this.enqueuedJobs.length = 0;
    this.completedJobs.length = 0;
    this.failedJobs.length = 0;
    this.schedulers.clear();
  }

  async close(): Promise<void> {
    this.processor = undefined;
  }
}
