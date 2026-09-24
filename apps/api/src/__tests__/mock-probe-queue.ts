import { JobQueue, type QueueJob, type QueueJobCounts, type QueueJobOptions } from '@vp/core/ports';
import type { QueueUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export interface RecordedProbeJob {
  name: string;
  data: Record<string, unknown>;
  opts?: QueueJobOptions;
}

/**
 * Records what a route enqueued without running it, which is what the upload suites assert on.
 * `InMemoryJobQueue` would drain the job instead, so the two are not interchangeable here.
 */
export class MockProbeJobQueue extends JobQueue {
  readonly jobs: RecordedProbeJob[] = [];

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }

  getName(): string {
    return 'probe';
  }

  async add<T = unknown>(
    name: string,
    data: T,
    opts?: QueueJobOptions
  ): Promise<Result<QueueJob<T>, QueueUnavailable>> {
    this.jobs.push({ name, data: data as Record<string, unknown>, opts });
    return ok({ id: opts?.jobId || 'probe-1', name, data, opts });
  }

  async process(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }

  async isPaused(): Promise<Result<boolean, QueueUnavailable>> {
    return ok(false);
  }

  async pause(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }

  async resume(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }

  async getJobCounts(): Promise<Result<QueueJobCounts, QueueUnavailable>> {
    return ok({
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
      prioritized: 0,
      paused: 0,
    });
  }

  async getJobs(): Promise<Result<QueueJob<unknown>[], QueueUnavailable>> {
    return ok([]);
  }

  async getJobState(_jobId: string): Promise<Result<string | undefined, QueueUnavailable>> {
    return ok('completed');
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    return ok();
  }
}
