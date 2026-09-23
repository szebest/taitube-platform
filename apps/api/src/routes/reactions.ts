import { getMyReaction, setReaction } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { ReactionService } from '../services/reaction-service';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export interface ReactionsRouteOptions {
  reactionService: ReactionService;
}

/**
 * Fastify routes plugin for high-throughput video reactions (Ticket 40, SDD §6.1).
 * Thin transport adapter delegating reaction mutations and reads to ReactionService.
 */
export function registerReactionsRoutes(
  app: FastifyInstance,
  options: ReactionsRouteOptions
): void {
  const { reactionService } = options;
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
