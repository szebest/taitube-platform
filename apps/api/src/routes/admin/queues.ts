import type { FastifyInstance } from 'fastify';
import { sendResult } from '../send-result';

export async function adminQueuesRoutes(app: FastifyInstance): Promise<void> {
  const { queueService } = app.services;

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
