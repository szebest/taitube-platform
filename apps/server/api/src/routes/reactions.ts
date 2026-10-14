import { getMyReaction, setReaction } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function reactionsRoutes(app: FastifyInstance): Promise<void> {
  const { reactionService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(setReaction)) {
    server.put(
      path,
      {
        schema: {
          ...contractSchema(setReaction, { hide }),
          params: setReaction.params,
          body: setReaction.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        return sendResult(
          reply,
          request,
          await reactionService.setReaction(user, id, request.body.type)
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(getMyReaction)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getMyReaction, { hide }),
          params: getMyReaction.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        return sendResult(reply, request, await reactionService.getUserReaction(user, id));
      }
    );
  }
}
