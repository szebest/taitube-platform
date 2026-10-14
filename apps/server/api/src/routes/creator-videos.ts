import { deleteCreatorVideo, listCreatorVideos, updateCreatorVideo } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { presentPublicVideoFailure } from './videos.presenter';

export async function creatorVideosRoutes(app: FastifyInstance): Promise<void> {
  const { creatorStudioService, videoService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listCreatorVideos.path,
    {
      schema: { ...contractSchema(listCreatorVideos), querystring: listCreatorVideos.query },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(reply, request, await creatorStudioService.library(user, request.query));
    }
  );

  server.patch(
    updateCreatorVideo.path,
    {
      schema: {
        ...contractSchema(updateCreatorVideo),
        params: updateCreatorVideo.params,
        body: updateCreatorVideo.body,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const updated = await creatorStudioService.update(user, request.params.id, request.body);
      return sendResult(reply, request, updated, {
        present: (failure) => presentPublicVideoFailure(failure, request.url),
      });
    }
  );

  server.delete(
    deleteCreatorVideo.path,
    {
      schema: { ...contractSchema(deleteCreatorVideo), params: deleteCreatorVideo.params },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      const deleted = await videoService.softDelete(user, request.params.id);
      return sendResult(reply, request, deleted, { status: 202 });
    }
  );
}
