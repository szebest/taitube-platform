import { map } from '@kit/result';
import { getHome, getRelatedVideos } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { PER_VIEWER_HEADERS, viewerSessionOf } from './video-access-request';
import { presentPublicVideoFailure } from './videos.presenter';

export async function recommendationsRoutes(app: FastifyInstance): Promise<void> {
  const { homeService, relatedService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(getHome.path, { schema: contractSchema(getHome) }, async (request, reply) => {
    reply.headers(PER_VIEWER_HEADERS);
    return sendResult(
      reply,
      request,
      await homeService.get(request.user ?? null, viewerSessionOf(request))
    );
  });

  server.get(
    getRelatedVideos.path,
    { schema: { ...contractSchema(getRelatedVideos), params: getRelatedVideos.params } },
    async (request, reply) => {
      const related = await relatedService.get(
        request.user ?? null,
        request.params.id,
        viewerSessionOf(request)
      );
      reply.headers(PER_VIEWER_HEADERS);
      return sendResult(
        reply,
        request,
        map(related, (items) => ({ items })),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      );
    }
  );
}
