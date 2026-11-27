import { getCreatorStats, problemFor } from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function creatorStatsRoutes(app: FastifyInstance): Promise<void> {
  const { analyticsService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getCreatorStats.path,
    { schema: { ...contractSchema(getCreatorStats), params: getCreatorStats.params } },
    async (request, reply) => {
      const user = requireAuth(request);
      reply.header('cache-control', 'private, no-store');
      return sendResult(
        reply,
        request,
        await analyticsService.creatorStats(user, request.params.id),
        {
          on: { FORBIDDEN: (failure) => problemFor(publicReadFailure(failure), request.url) },
        }
      );
    }
  );
}
