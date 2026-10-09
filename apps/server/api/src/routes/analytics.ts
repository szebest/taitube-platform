import { getChannelAnalytics, getVideoAnalytics, problemFor } from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const { analyticsService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getVideoAnalytics.path,
    {
      schema: {
        ...contractSchema(getVideoAnalytics),
        params: getVideoAnalytics.params,
        querystring: getVideoAnalytics.query,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.videoAnalytics(user, request.params.id, request.query.range),
        { on: { FORBIDDEN: (failure) => problemFor(publicReadFailure(failure), request.url) } }
      );
    }
  );

  server.get(
    getChannelAnalytics.path,
    {
      schema: {
        ...contractSchema(getChannelAnalytics),
        querystring: getChannelAnalytics.query,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.channelAnalytics(user, request.query.range)
      );
    }
  );
}
