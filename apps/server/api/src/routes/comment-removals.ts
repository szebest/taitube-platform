import { listMyCommentRemovals } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function commentRemovalsRoutes(app: FastifyInstance): Promise<void> {
  const { commentRemovalService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listMyCommentRemovals.path,
    {
      schema: {
        ...contractSchema(listMyCommentRemovals),
        querystring: listMyCommentRemovals.query,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(reply, request, await commentRemovalService.listOwn(user, request.query));
    }
  );
}
