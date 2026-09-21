import { createBullBoard } from '@bull-board/api';
import { FastifyAdapter } from '@bull-board/fastify';
import { CaslAuthorizationAdapter } from '@vp/adapters';
import { bullBoardQueues } from '@vp/adapters/bullmq';
import type { AuthorizationPort, JobQueue } from '@vp/core/ports';
import { PermanentError } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import type { FastifyPluginCallback } from 'fastify';
import type { AuthUser } from '../plugins/auth';
import { assertAdminAccess } from './admin-access';

export interface QueueServiceDeps {
  queues?: Map<string, JobQueue>;
  authorization?: AuthorizationPort;
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
  private readonly auth: AuthorizationPort;

  constructor(deps: QueueServiceDeps = {}) {
    this.queuesMap = deps.queues ?? new Map<string, JobQueue>();
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
  }

  /**
   * Guards the Bull Board operator UI, which the board plugin serves itself.
   */
  assertAdmin(caller: AuthUser | null): void {
    assertAdminAccess(this.auth, caller);
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
    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: bullBoardQueues(this.queuesMap.values()),
      serverAdapter,
    });

    return serverAdapter.registerPlugin();
  }
}
