import {
  listRecommendationFeedback,
  putRecommendationFeedback,
  removeRecommendationFeedback,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function recommendationFeedbackRoutes(app: FastifyInstance): Promise<void> {
  const { recommendationFeedbackService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.put(
    putRecommendationFeedback.path,
    {
      schema: {
        ...contractSchema(putRecommendationFeedback),
        body: putRecommendationFeedback.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await recommendationFeedbackService.put(requireAuth(request), request.body)
      )
  );

  server.get(
    listRecommendationFeedback.path,
    {
      schema: {
        ...contractSchema(listRecommendationFeedback),
        querystring: listRecommendationFeedback.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await recommendationFeedbackService.list(requireAuth(request), request.query)
      )
  );

  server.delete(
    removeRecommendationFeedback.path,
    {
      schema: {
        ...contractSchema(removeRecommendationFeedback),
        params: removeRecommendationFeedback.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await recommendationFeedbackService.remove(requireAuth(request), request.params.id),
        { status: removeRecommendationFeedback.status }
      )
  );
}
