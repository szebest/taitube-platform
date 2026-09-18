import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth';
import { problemResponse } from '../schemas/problem';
import {
  ReactionInputSchema,
  UserReactionResponseSchema,
  VideoReactionResponseSchema,
} from '../schemas/reactions';
import type { ReactionService } from '../services/reaction-service';

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

  // 1. PUT /v1/videos/:id/reactions (and /videos/:id/reactions) — Set or clear reaction
  for (const path of ['/v1/videos/:id/reactions', '/videos/:id/reactions'] as const) {
    const isAlias = path === '/videos/:id/reactions';
    server.put(
      path,
      {
        schema: {
          tags: ['Reactions'],
          summary: 'Set or clear video reaction (LIKE / DISLIKE / NONE)',
          description:
            'Idempotently updates caller reaction. Atomically adjusts Postgres and Redis counters.',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          body: ReactionInputSchema,
          response: {
            200: VideoReactionResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Forbidden action'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
          },
          ...(isAlias ? { hide: true } : {}),
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

  // 2. GET /v1/videos/:id/reactions/me (and /videos/:id/reactions/me) — Get current caller reaction
  for (const path of ['/v1/videos/:id/reactions/me', '/videos/:id/reactions/me'] as const) {
    const isAlias = path === '/videos/:id/reactions/me';
    server.get(
      path,
      {
        schema: {
          tags: ['Reactions'],
          summary: 'Get authenticated caller reaction for a video',
          description:
            'Returns authenticated caller reaction (LIKE, DISLIKE, or null if no reaction).',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          response: {
            200: UserReactionResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Invalid video ID format'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
          },
          ...(isAlias ? { hide: true } : {}),
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
