import { getMyReaction, setReaction } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { ReactionService } from '../services/reaction-service';
import { contractSchema } from './contract-schema';

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

  for (const path of ['/v1/videos/:id/reactions', '/videos/:id/reactions'] as const) {
    server.put(
      path,
      {
        schema: {
          ...contractSchema(setReaction, { hide: path === '/videos/:id/reactions' }),
          params: setReaction.params,
          body: setReaction.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        request.authorize('video:react');
        const { id } = request.params;
        const result = await reactionService.setReaction(user, id, request.body.type);
        return reply.status(200).send(result);
      }
    );
  }

  for (const path of ['/v1/videos/:id/reactions/me', '/videos/:id/reactions/me'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getMyReaction, { hide: path === '/videos/:id/reactions/me' }),
          params: getMyReaction.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        const result = await reactionService.getUserReaction(user, id);
        return reply.status(200).send(result);
      }
    );
  }
}
