import type { CacheClient, JobQueue } from '@vp/core/ports';
import { ErrorCodes, PermanentError, PipelineError } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../plugins/auth';
import { QueueService } from '../../services/queue-service';

export interface AdminQueuesOptions {
  cache?: CacheClient | null;
  redisClient?: CacheClient | null;
  queues?: Map<string, JobQueue>;
  queueService?: QueueService;
}

/**
 * Admin Queues Route — Thin HTTP transport adapter providing Bull Board admin UI
 * and queue inspection endpoints, delegating all operations to QueueService.
 */
export async function registerAdminQueuesRoutes(
  app: FastifyInstance,
  options: AdminQueuesOptions = {}
): Promise<void> {
  const queueService =
    options.queueService ??
    new QueueService({
      queues: options.queues,
    });

  const boardPlugin = queueService.getBoardPlugin('/admin/queues');

  // Encapsulated admin scope protected by requireAdmin (Ticket 10: AC 17)
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

      adminScope.register(boardPlugin);
    },
    { prefix: '/admin/queues' }
  );
}
