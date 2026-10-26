import { getHome, getRelatedVideos } from '@vp/api-contracts';
import { map } from '@vp/result';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { presentPublicVideoFailure } from './videos.presenter';

export async function recommendationsRoutes(app: FastifyInstance): Promise<void> {
  const { homeService, relatedService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(getHome.path, { schema: contractSchema(getHome) }, async (request, reply) => {
    reply.headers({ 'Cache-Control': 'private, no-cache', Vary: 'Authorization' });
    return sendResult(reply, request, await homeService.get(request.user ?? null));
  });

  server.get(
    getRelatedVideos.path,
    { schema: { ...contractSchema(getRelatedVideos), params: getRelatedVideos.params } },
    async (request, reply) => {
      const related = await relatedService.get(request.user ?? null, request.params.id);
      reply.headers({ 'Cache-Control': 'private, no-cache', Vary: 'Authorization' });
      return sendResult(
        reply,
        request,
        map(related, (items) => ({ items })),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      );
    }
  );
}
