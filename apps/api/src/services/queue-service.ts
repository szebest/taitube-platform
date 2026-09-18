import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { JobQueue } from '@vp/core/ports';
import { PermanentError } from '@vp/errors';
import { QUEUES, type QueueName } from '@vp/job-contracts';
import type { FastifyPluginCallback } from 'fastify';

export interface QueueServiceDeps {
  queues?: Map<string, JobQueue>;
}

export interface QueueCountMetrics {
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
}

export interface QueueStatus {
  name: string;
  isPaused: boolean;
  counts: QueueCountMetrics;
}

/**
 * QueueService — Domain service managing BullMQ queues inspection, Bull Board integration,
 * and operational controls (pause, resume, metrics).
 */
export class QueueService {
  private readonly queuesMap: Map<string, JobQueue>;

  constructor(deps: QueueServiceDeps = {}) {
    this.queuesMap = deps.queues ?? new Map<string, JobQueue>();
  }

  /**
   * Returns the registered JobQueue port for a specific queue name.
   */
  getQueue(name: string): JobQueue | undefined {
    return this.queuesMap.get(name);
  }

  /**
   * Collects runtime status and job counts across all known queues.
   */
  async getQueueMetrics(): Promise<QueueStatus[]> {
    const statuses: QueueStatus[] = [];

    for (const queueName of QUEUES) {
      const q = this.queuesMap.get(queueName);
      if (!q) {
        statuses.push({
          name: queueName,
          isPaused: false,
          counts: { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0, paused: 0 },
        });
        continue;
      }

      const [isPaused, counts] = await Promise.all([
        typeof q.isPaused === 'function' ? q.isPaused() : Promise.resolve(false),
        typeof q.getJobCounts === 'function'
          ? q.getJobCounts()
          : Promise.resolve({
              active: 0,
              completed: 0,
              failed: 0,
              delayed: 0,
              waiting: 0,
              paused: 0,
            }),
      ]);

      statuses.push({
        name: queueName,
        isPaused,
        counts,
      });
    }

    return statuses;
  }

  /**
   * Pauses a specific job queue.
   */
  async pauseQueue(queueName: string): Promise<void> {
    const q = this.queuesMap.get(queueName);
    if (!q) {
      throw new PermanentError('QUEUE_NOT_FOUND', `Queue "${queueName}" not found`);
    }
    if (typeof q.pause === 'function') {
      await q.pause();
    }
  }

  /**
   * Resumes a specific job queue.
   */
  async resumeQueue(queueName: string): Promise<void> {
    const q = this.queuesMap.get(queueName);
    if (!q) {
      throw new PermanentError('QUEUE_NOT_FOUND', `Queue "${queueName}" not found`);
    }
    if (typeof q.resume === 'function') {
      await q.resume();
    }
  }

  /**
   * Configures and returns the Bull Board Fastify plugin mounted at the given basePath.
   */
  getBoardPlugin(basePath: string): FastifyPluginCallback {
    const queueAdapters = QUEUES.map((queueName: QueueName) => {
      const q = this.queuesMap.get(queueName);
      if (!q) {
        const dummyQueue = {
          name: queueName,
          isPaused: async () => false,
          pause: async () => {},
          resume: async () => {},
          getJobCounts: async () => ({
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            waiting: 0,
            paused: 0,
          }),
          getJobs: async () => [],
          opts: { prefix: 'bull' },
          metaValues: { version: 'bullmq' },
        };
        return new BullMQAdapter(
          dummyQueue as unknown as ConstructorParameters<typeof BullMQAdapter>[0]
        );
      }

      const queueWithRaw = q as { getRawQueue?: () => unknown };
      const rawQueue =
        typeof queueWithRaw.getRawQueue === 'function' ? queueWithRaw.getRawQueue() : q;
      return new BullMQAdapter(
        rawQueue as unknown as ConstructorParameters<typeof BullMQAdapter>[0]
      );
    });

    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: queueAdapters,
      serverAdapter,
    });

    return serverAdapter.registerPlugin();
  }
}
