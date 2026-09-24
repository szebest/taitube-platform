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
import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, assertNever, fromPromise, map, tryCatch } from '@vp/result';
import {
  type ConnectionOptions,
  type Job,
  type JobType,
  type JobsOptions,
  Queue,
  type QueueOptions,
  Worker,
  type WorkerOptions,
} from 'bullmq';
import { bullMqProcessor } from './bullmq-processor';
import { checkBackendHealth } from './connection';
import { toJobsOptions, toQueueJob } from './job-mapping';

export type WorkerFactory = (
  name: string,
  processor: (job: Job) => Promise<unknown>,
  options: WorkerOptions
) => Worker;

export type BullMqJobQueueConfig = {
  name: string;
  createWorker?: WorkerFactory;
} & (
  | { type: 'queue'; queue: Queue }
  | {
      type: 'connection';
      connection: ConnectionOptions;
      prefix: string;
      options?: Omit<QueueOptions, 'connection' | 'prefix'>;
    }
);

export class BullMqJobQueue extends JobQueue {
  private readonly queue: Queue;
  private readonly createWorker: WorkerFactory;
  private worker?: Worker;
  private failedHandler?: (job: QueueJob<unknown>, err: Error) => Promise<void> | void;
  private stalledHandler?: (jobId: string) => void;

  constructor(config: BullMqJobQueueConfig) {
    super();
    this.createWorker =
      config.createWorker ?? ((name, processor, options) => new Worker(name, processor, options));
    this.queue = BullMqJobQueue.queueFor(config);
  }

  private static queueFor(config: BullMqJobQueueConfig): Queue {
    switch (config.type) {
      case 'queue':
        return config.queue;
      case 'connection':
        return new Queue(config.name, {
          connection: config.connection,
          prefix: config.prefix,
          ...config.options,
        });
      default:
        return assertNever(config, 'BullMqJobQueueConfig');
    }
  }

  private unavailable(operation: string) {
    return (cause: unknown): QueueUnavailable => queueUnavailable(operation, cause);
  }

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    return checkBackendHealth(this.queue);
  }

  getName(): string {
    return this.queue.name;
  }

  getRawQueue(): Queue {
    return this.queue;
  }

  async getJobState(jobId: string): Promise<Result<string | undefined, QueueUnavailable>> {
    return fromPromise(async () => {
      const job = await this.queue.getJob(jobId);
      return job ? await job.getState() : undefined;
    }, this.unavailable('getJobState'));
  }

  onFailed(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void {
    this.failedHandler = handler;
  }

  onStalled(handler: (jobId: string) => void): void {
    this.stalledHandler = handler;
  }

  /** Handlers are read when the event fires, so one set after `process()` still hears it. */
  private listen(worker: Worker): void {
    worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) this.failedHandler?.(toQueueJob(job), err);
    });
    worker.on('stalled', (jobId: string) => this.stalledHandler?.(jobId));
  }

  async add<T = unknown>(
    name: string,
    data: T,
    options?: QueueJobOptions
  ): Promise<Result<QueueJob<T>, QueueUnavailable>> {
    const added = await fromPromise(
      () => this.queue.add(name, data, toJobsOptions(options)),
      this.unavailable('add')
    );

    return map(added, (job) => toQueueJob<T>(job));
  }

  async process<T = unknown>(
    handler: (job: QueueJob<T>) => Promise<unknown>,
    options?: QueueWorkerOptions
  ): Promise<Result<void, QueueUnavailable>> {
    const started = tryCatch(
      () =>
        this.createWorker(this.queue.name, bullMqProcessor<T>(handler), {
          connection: this.queue.opts.connection as ConnectionOptions,
          prefix: this.queue.opts.prefix,
          concurrency: options?.concurrency,
          lockDuration: options?.lockDurationMs,
          lockRenewTime: options?.lockRenewTimeMs,
          stalledInterval: options?.stalledIntervalMs,
          maxStalledCount: options?.maxStalledCount,
        }),
      this.unavailable('process')
    );

    return map(started, (worker) => {
      this.worker = worker;
      this.listen(worker);
    });
  }

  async isPaused(): Promise<Result<boolean, QueueUnavailable>> {
    return fromPromise(() => this.queue.isPaused(), this.unavailable('isPaused'));
  }

  async pause(): Promise<Result<void, QueueUnavailable>> {
    return fromPromise(() => this.queue.pause(), this.unavailable('pause'));
  }

  async resume(): Promise<Result<void, QueueUnavailable>> {
    return fromPromise(() => this.queue.resume(), this.unavailable('resume'));
  }

  async getJobCounts(): Promise<Result<QueueJobCounts, QueueUnavailable>> {
    const counted = await fromPromise(
      () =>
        this.queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused' as JobType
        ),
      this.unavailable('getJobCounts')
    );

    return map(counted, (counts) => ({
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    }));
  }

  async getJobs(
    types: JobType[] = ['waiting', 'active', 'completed', 'failed']
  ): Promise<Result<QueueJob<unknown>[], QueueUnavailable>> {
    const jobs = await fromPromise(() => this.queue.getJobs(types), this.unavailable('getJobs'));

    return map(jobs, (found) => found.map((job) => toQueueJob(job)));
  }

  override async upsertJobScheduler<T = unknown>(
    id: string,
    repeatOpts: UpsertJobSchedulerOptions,
    template?: JobSchedulerTemplate<T>
  ): Promise<Result<unknown, QueueUnavailable>> {
    return fromPromise(
      () =>
        this.queue.upsertJobScheduler(
          id,
          { pattern: repeatOpts.pattern, every: repeatOpts.every },
          template
            ? {
                name: template.name,
                data: template.data as Record<string, unknown>,
                opts: template.opts as JobsOptions,
              }
            : undefined
        ),
      this.unavailable('upsertJobScheduler')
    );
  }

  override async getJobSchedulers(): Promise<Result<JobSchedulerInfo[], QueueUnavailable>> {
    const schedulers = await fromPromise(
      () => this.queue.getJobSchedulers(),
      this.unavailable('getJobSchedulers')
    );

    return map(schedulers, (found) =>
      found.map((s) => ({
        id: s.id ?? s.name ?? s.key,
        name: s.name ?? s.id ?? '',
        pattern: s.pattern,
        every: s.every,
        data: s.template?.data,
      }))
    );
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    return fromPromise(async () => {
      if (this.worker) await this.worker.close(false);
      await this.queue.close();
    }, this.unavailable('close'));
  }
}
