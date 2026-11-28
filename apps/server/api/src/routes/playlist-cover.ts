import { completePlaylistCover, preparePlaylistCover } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** A custom cover upload; the edit that names it makes it the cover. */
export async function playlistCoverRoutes(app: FastifyInstance): Promise<void> {
  const { playlistCoverService: covers } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    preparePlaylistCover.path,
    {
      schema: {
        ...contractSchema(preparePlaylistCover),
        params: preparePlaylistCover.params,
        body: preparePlaylistCover.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await covers.prepare(requireAuth(request), request.params.id, request.body),
        { status: preparePlaylistCover.status }
      )
  );

  server.post(
    completePlaylistCover.path,
    {
      schema: {
        ...contractSchema(completePlaylistCover),
        params: completePlaylistCover.params,
        body: completePlaylistCover.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await covers.complete(requireAuth(request), request.params.id, request.body),
        { status: completePlaylistCover.status }
      )
  );
}
