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

  getQueue(name: string): JobQueue | undefined {
    return this.queuesMap.get(name);
  }

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

      const [isPaused, counts] = await Promise.all([q.isPaused(), q.getJobCounts()]);

      statuses.push({ name: queueName, isPaused, counts });
    }

    return statuses;
  }

  async pauseQueue(queueName: string): Promise<void> {
    await this.requireQueue(queueName).pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    await this.requireQueue(queueName).resume();
  }

  getBoardPlugin(basePath: string): FastifyPluginCallback {
    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: bullBoardQueues(this.queuesMap.values()),
      serverAdapter,
    });

    return serverAdapter.registerPlugin();
  }

  private requireQueue(queueName: string): JobQueue {
    const q = this.queuesMap.get(queueName);
    if (!q) {
      throw new PermanentError('QUEUE_NOT_FOUND', `Queue "${queueName}" not found`);
    }
    return q;
  }
}
