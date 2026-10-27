import { listCreatorComments } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function creatorCommentsRoutes(app: FastifyInstance): Promise<void> {
  const { creatorCommentService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listCreatorComments)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listCreatorComments, { hide }),
          querystring: listCreatorComments.query,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(reply, request, await creatorCommentService.inbox(user, request.query));
      }
    );
  }
}
