import type { FastifyInstance } from 'fastify';
import type { QueueService } from '../../services/queue-service';
import { sendResult } from '../send-result';

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
      // Bull Board serves its own UI, so the gate is a hook rather than a handler; it still hands
      // the verdict to the one seam that renders a `Problem`.
      adminScope.addHook('onRequest', async (request, reply) => {
        const admitted = queueService.requireAdmin(request.user);
        if (!admitted.ok) return sendResult(reply, request, admitted);
        return undefined;
      });

      adminScope.register(boardPlugin);
    },
    { prefix: '/admin/queues' }
  );
}
