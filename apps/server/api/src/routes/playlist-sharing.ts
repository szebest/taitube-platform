import {
  createPlaylistShareLink,
  getPlaylistStats,
  listPlaylistShareLinks,
  revokePlaylistShareLink,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** The owner's share links of a playlist, and the numbers only the owner reads. */
export async function playlistSharingRoutes(app: FastifyInstance): Promise<void> {
  const { playlistSharingService: sharing } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listPlaylistShareLinks.path,
    {
      schema: { ...contractSchema(listPlaylistShareLinks), params: listPlaylistShareLinks.params },
    },
    async (request, reply) =>
      sendResult(reply, request, await sharing.list(requireAuth(request), request.params.id))
  );

  server.post(
    createPlaylistShareLink.path,
    {
      schema: {
        ...contractSchema(createPlaylistShareLink),
        params: createPlaylistShareLink.params,
        body: createPlaylistShareLink.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await sharing.create(requireAuth(request), request.params.id, request.body),
        { status: createPlaylistShareLink.status }
      )
  );

  server.delete(
    revokePlaylistShareLink.path,
    {
      schema: {
        ...contractSchema(revokePlaylistShareLink),
        params: revokePlaylistShareLink.params,
      },
    },
    async (request, reply) => {
      const { id, linkId } = request.params;
      return sendResult(reply, request, await sharing.revoke(requireAuth(request), id, linkId), {
        status: revokePlaylistShareLink.status,
      });
    }
  );

  server.get(
    getPlaylistStats.path,
    {
      schema: {
        ...contractSchema(getPlaylistStats),
        params: getPlaylistStats.params,
        querystring: getPlaylistStats.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await sharing.stats(requireAuth(request), request.params.id, request.query.range)
      )
  );
}
