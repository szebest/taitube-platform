import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { ErrorCodes, PermanentError, PipelineError } from '@vp/errors';
import { QUEUES, type QueueName } from '@vp/job-contracts';
import { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { requireAdmin } from '../../plugins/auth.js';

export interface AdminQueuesOptions {
  redisClient?: Redis | null;
  queues?: Map<string, Queue>;
}

export async function registerAdminQueuesRoutes(
  app: FastifyInstance,
  options: AdminQueuesOptions = {}
): Promise<void> {
  const queuesMap = options.queues || new Map<string, Queue>();

  // 1. Initialize BullMQAdapter for all queues in QUEUES (including 'dlq')
  const queueAdapters = QUEUES.map((queueName: QueueName) => {
    let q = queuesMap.get(queueName);
    if (!q) {
      if (
        options.redisClient &&
        typeof (options.redisClient as unknown as { duplicate?: unknown }).duplicate === 'function'
      ) {
        q = new Queue(queueName, {
          connection: (options.redisClient as Redis).duplicate(),
          prefix: 'bull',
        });
      } else {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
        q = new Queue(queueName, {
          connection: client,
          prefix: 'bull',
        });
      }
      queuesMap.set(queueName, q);
    }
    return new BullMQAdapter(q);
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
