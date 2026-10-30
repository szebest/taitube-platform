import { listLikedVideos, listMyComments } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function viewerActivityRoutes(app: FastifyInstance): Promise<void> {
  const { viewerActivityService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listLikedVideos.path,
    { schema: { ...contractSchema(listLikedVideos), querystring: listLikedVideos.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await viewerActivityService.likedVideos(requireAuth(request), request.query)
      )
  );

  server.get(
    listMyComments.path,
    { schema: { ...contractSchema(listMyComments), querystring: listMyComments.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await viewerActivityService.comments(requireAuth(request), request.query)
      )
  );
}
