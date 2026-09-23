import { createBullBoard } from '@bull-board/api';
import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { JobQueue } from '@vp/core/ports';
import {
  type AuthorizationFailure,
  type ReplayQueueUnknown,
  decideAdminAccess,
  replayQueueUnknown,
} from '@vp/domain-rules';
import type { QueueUnavailable } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { type Result, all, err, isErr, map, ok } from '@vp/result';
import type { FastifyPluginCallback } from 'fastify';

export interface QueueServiceDeps {
  queues: Map<string, JobQueue>;
  boardQueues: (queues: Iterable<JobQueue>) => BaseAdapter[];
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

const IDLE_COUNTS: QueueCountMetrics = {
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  waiting: 0,
  paused: 0,
};

export class QueueService {
  private readonly queuesMap: Map<string, JobQueue>;
  private readonly boardQueues: QueueServiceDeps['boardQueues'];

  constructor(deps: QueueServiceDeps) {
    this.queuesMap = deps.queues;
    this.boardQueues = deps.boardQueues;
  }

  /**
   * Guards the Bull Board operator UI, which the board plugin serves itself. It returns the verdict
   * rather than throwing it, so the pre-handler renders a `Problem` instead of catching.
   */
  requireAdmin(caller: UserContext | null): Result<UserContext, AuthorizationFailure> {
    return decideAdminAccess(caller);
  }

  getQueue(name: string): JobQueue | undefined {
    return this.queuesMap.get(name);
  }

  async getQueueMetrics(): Promise<Result<QueueStatus[], QueueUnavailable>> {
    const statuses: Result<QueueStatus, QueueUnavailable>[] = [];

    for (const queueName of QUEUES) {
      statuses.push(await this.statusOf(queueName));
    }

    return all(statuses);
  }

  private async statusOf(name: string): Promise<Result<QueueStatus, QueueUnavailable>> {
    const queue = this.queuesMap.get(name);
    if (!queue) return ok({ name, isPaused: false, counts: IDLE_COUNTS });

    const isPaused = await queue.isPaused();
    if (isErr(isPaused)) return isPaused;

    return map(await queue.getJobCounts(), (counts) => ({
      name,
      isPaused: isPaused.value,
      counts,
    }));
  }

  async pauseQueue(
    queueName: string
  ): Promise<Result<void, ReplayQueueUnknown | QueueUnavailable>> {
    const queue = this.queuesMap.get(queueName);
    return queue ? queue.pause() : err(replayQueueUnknown(queueName));
  }

  async resumeQueue(
    queueName: string
  ): Promise<Result<void, ReplayQueueUnknown | QueueUnavailable>> {
    const queue = this.queuesMap.get(queueName);
    return queue ? queue.resume() : err(replayQueueUnknown(queueName));
  }

  getBoardPlugin(basePath: string): FastifyPluginCallback {
    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: this.boardQueues(this.queuesMap.values()),
      serverAdapter,
    });

    return serverAdapter.registerPlugin();
  }
}
