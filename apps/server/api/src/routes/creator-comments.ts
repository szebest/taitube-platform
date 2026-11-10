import { bulkModerateComments, listCreatorComments } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function creatorCommentsRoutes(app: FastifyInstance): Promise<void> {
  const { creatorCommentService, commentBulkService } = app.services;
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
        const { user, acting } = requireActingChannel(request);
        return sendResult(
          reply,
          request,
          await creatorCommentService.inbox(user, acting, request.query)
        );
      }
    );
  }

  server.post(
    bulkModerateComments.path,
    { schema: { ...contractSchema(bulkModerateComments), body: bulkModerateComments.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const { ids, action } = request.body;
      return sendResult(reply, request, await commentBulkService.apply(user, acting, ids, action));
    }
  );
}
