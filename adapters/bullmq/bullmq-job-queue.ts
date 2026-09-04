import {
  JobQueue,
  QueueError,
  type QueueJob,
  type QueueJobCounts,
  type QueueJobOptions,
  type QueueWorkerOptions,
} from '@vp/core/ports';
import {
  type ConnectionOptions,
  type Job,
  Queue,
  type QueueOptions,
  UnrecoverableError,
  Worker,
} from 'bullmq';

export interface BullMqJobQueueConfig {
  name: string;
  connection?: ConnectionOptions;
  options?: Omit<QueueOptions, 'connection'>;
  queue?: Queue;
}

export class BullMqJobQueue extends JobQueue {
  private readonly queue: Queue;
  private worker?: Worker;
  private failedHandler?: (job: QueueJob<unknown>, err: Error) => Promise<void> | void;

  constructor(config: BullMqJobQueueConfig) {
    super();
    if (config.queue) {
      this.queue = config.queue;
      return;
    }

    const connection =
      config.connection ??
      ({
        host: process.env['REDIS_HOST'] ?? '127.0.0.1',
        port: Number(process.env['REDIS_PORT'] ?? 6379),
      } as ConnectionOptions);

    this.queue = new Queue(config.name, {
      connection,
      prefix: 'bull',
      ...config.options,
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = await (this.queue as any).client;
      if (!client) return true;
      const res = await client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  getName(): string {
    return this.queue.name;
  }

  getRawQueue(): Queue {
    return this.queue;
  }

  async getJobState(jobId: string): Promise<string | undefined> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return undefined;
      return await job.getState();
    } catch (err: unknown) {
      throw new QueueError(`Failed to get job state for "${jobId}": ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  onFailed(handler: (job: QueueJob<unknown>, err: Error) => Promise<void> | void): void {
    this.failedHandler = handler;
    if (this.worker) {
      this.worker.on('failed', (job: Job | undefined, err: Error) => {
        if (job) {
          handler(
            {
              id: job.id ?? '',
              name: job.name,
              data: job.data,
              attemptsMade: job.attemptsMade,
            },
            err
          );
        }
      });
    }
  }

  async add<T = unknown>(name: string, data: T, options?: QueueJobOptions): Promise<QueueJob<T>> {
    try {
      const job = await this.queue.add(name, data, {
        jobId: options?.jobId,
        attempts: options?.attempts,
        backoff: options?.backoff as any,
        removeOnComplete: options?.removeOnComplete as any,
        removeOnFail: options?.removeOnFail as any,
      });

      return {
        id: job.id ?? '',
        name: job.name,
        data: job.data as T,
        attemptsMade: job.attemptsMade,
      };
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to enqueue job "${name}" on queue "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async process<T = unknown>(
    handler: (job: QueueJob<T>) => Promise<unknown>,
    options?: QueueWorkerOptions
  ): Promise<void> {
    try {
      const connection = (this.queue.opts.connection as any) ?? {
        host: process.env['REDIS_HOST'] ?? '127.0.0.1',
        port: Number(process.env['REDIS_PORT'] ?? 6379),
      };

      this.worker = new Worker(
        this.queue.name,
        async (job: Job) => {
          try {
            return await handler({
              id: job.id ?? '',
              name: job.name,
              data: job.data as T,
              attemptsMade: job.attemptsMade,
              updateProgress: async (progress: number | object) => {
                await job.updateProgress(progress as any);
              },
              getChildrenValues: async <R = Record<string, unknown>>() => {
                const values = await job.getChildrenValues();
                return (values ?? {}) as R;
              },
              getState: async () => {
                return await job.getState();
              },
            });
          } catch (err: unknown) {
            // If the error is marked permanent (non-retryable), signal BullMQ via UnrecoverableError
            if ((err as { isRetryable?: boolean }).isRetryable === false) {
              throw new UnrecoverableError((err as Error).message);
            }
            throw err;
          }
        },
        {
          connection,
          prefix: this.queue.opts.prefix,
          concurrency: options?.concurrency,
          lockDuration: options?.lockDurationMs,
          lockRenewTime: options?.lockRenewTimeMs,
          stalledInterval: options?.stalledIntervalMs,
          maxStalledCount: options?.maxStalledCount,
        }
      );

      if (this.failedHandler) {
        this.worker.on('failed', (job: Job | undefined, err: Error) => {
          if (job && this.failedHandler) {
            this.failedHandler(
              {
                id: job.id ?? '',
                name: job.name,
                data: job.data,
                attemptsMade: job.attemptsMade,
              },
              err
            );
          }
        });
      }
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to start worker on queue "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async isPaused(): Promise<boolean> {
    try {
      return await this.queue.isPaused();
    } catch (err: unknown) {
      throw new QueueError(`Failed to check pause status: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async pause(): Promise<void> {
    try {
      await this.queue.pause();
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to pause queue "${this.queue.name}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async resume(): Promise<void> {
    try {
      await this.queue.resume();
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to resume queue "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused' as any
      );
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0,
      };
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to get job counts for queue "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async getJobs(
    types: any = ['waiting', 'active', 'completed', 'failed']
  ): Promise<QueueJob<unknown>[]> {
    try {
      const jobs = await this.queue.getJobs(types);
      return jobs.map((j) => ({
        id: j.id ?? '',
        name: j.name,
        data: j.data,
        attemptsMade: j.attemptsMade,
      }));
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to get jobs for queue "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async close(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.close();
      }
      await this.queue.close();
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to close queue/worker "${this.queue.name}": ${(err as Error).message}`,
        { cause: err }
      );
    }
  }
}
