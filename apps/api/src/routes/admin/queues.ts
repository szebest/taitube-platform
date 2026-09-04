import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { CacheClient, JobQueue } from '@vp/core/ports';
import { ErrorCodes, PermanentError, PipelineError } from '@vp/errors';
import { QUEUES, type QueueName } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../plugins/auth.js';

export interface AdminQueuesOptions {
  cache?: CacheClient | null;
  redisClient?: CacheClient | null;
  queues?: Map<string, JobQueue>;
}

export async function registerAdminQueuesRoutes(
  app: FastifyInstance,
  options: AdminQueuesOptions = {}
): Promise<void> {
  const queuesMap = options.queues || new Map<string, JobQueue>();

  // 1. Initialize BullMQAdapter for all queues in QUEUES (including 'dlq')
  const queueAdapters = QUEUES.map((queueName: QueueName) => {
    const q = queuesMap.get(queueName);
    if (!q) {
      // Create a mock/empty queue wrapper if not provided
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
      return new BullMQAdapter(dummyQueue as any);
    }

    // Unwrap concrete BullMQ queue if wrapped, otherwise adapt directly
    const rawQueue = typeof (q as any).getRawQueue === 'function' ? (q as any).getRawQueue() : q;
    return new BullMQAdapter(rawQueue);
  });

  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queueAdapters,
    serverAdapter,
  });

  // 2. Encapsulated admin scope protected by requireAdmin (AC 17)
  await app.register(
    async (adminScope) => {
      adminScope.addHook('onRequest', async (request, reply) => {
        try {
          requireAdmin(request);
        } catch (err) {
          if (err instanceof PermanentError || err instanceof PipelineError) {
            const statusCode = err.code === ErrorCodes.UNAUTHORIZED ? 401 : 403;
            return reply
              .status(statusCode)
              .header('content-type', 'application/problem+json; charset=utf-8')
              .send({
                type: `https://errors.video-pipeline.local/${err.code}`,
                title: err.code === ErrorCodes.UNAUTHORIZED ? 'Unauthorized' : 'Forbidden',
                status: statusCode,
                detail: err.message,
                code: err.code,
                instance: request.url,
              });
          }
          throw err;
        }
      });

      adminScope.register(serverAdapter.registerPlugin());
    },
    { prefix: '/admin/queues' }
  );
}
