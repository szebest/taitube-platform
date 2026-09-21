import { PipelineError } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { PROBLEM_CONTENT_TYPE, domainProblem } from '../../plugins/errors';
import type { QueueService } from '../../services/queue-service';

export interface AdminQueuesOptions {
  queueService: QueueService;
}

/**
 * Admin Queues Route — Thin HTTP transport adapter providing Bull Board admin UI
 * and queue inspection endpoints, delegating all operations to QueueService.
 */
export async function registerAdminQueuesRoutes(
  app: FastifyInstance,
  options: AdminQueuesOptions
): Promise<void> {
  const { queueService } = options;

  const boardPlugin = queueService.getBoardPlugin('/admin/queues');

  await app.register(
    async (adminScope) => {
      adminScope.addHook('onRequest', async (request, reply) => {
        try {
          queueService.assertAdmin(request.user);
        } catch (err) {
          if (!(err instanceof PipelineError)) throw err;
          const problem = domainProblem(err.code, err.message, request.url);
          return reply
            .status(problem.status)
            .header('content-type', PROBLEM_CONTENT_TYPE)
            .send(problem);
        }
      });

      adminScope.register(boardPlugin);
    },
    { prefix: '/admin/queues' }
  );
}
