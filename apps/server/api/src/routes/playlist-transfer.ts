import {
  duplicatePlaylist,
  exportPlaylist,
  importPlaylist,
  mergePlaylists,
  transferPlaylistItems,
} from '@vp/api-contracts';
import { PLAYLIST_IMPORT_MAX_BYTES } from '@vp/domain';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** The content's limit plus what escaping it in a JSON body can add. */
const IMPORT_BODY_LIMIT = 2 * PLAYLIST_IMPORT_MAX_BYTES;

export async function playlistTransferRoutes(app: FastifyInstance): Promise<void> {
  const { playlistTransferService: transfers, playlistPortabilityService: portability } =
    app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    transferPlaylistItems.path,
    {
      schema: {
        ...contractSchema(transferPlaylistItems),
        params: transferPlaylistItems.params,
        body: transferPlaylistItems.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await transfers.transfer(requireAuth(request), request.params.id, request.body)
      )
  );

  server.post(
    duplicatePlaylist.path,
    {
      schema: {
        ...contractSchema(duplicatePlaylist),
        params: duplicatePlaylist.params,
        body: duplicatePlaylist.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await transfers.duplicate(requireAuth(request), request.params.id, request.body),
        { status: duplicatePlaylist.status }
      )
  );

  server.post(
    mergePlaylists.path,
    { schema: { ...contractSchema(mergePlaylists), body: mergePlaylists.body } },
    async (request, reply) =>
      sendResult(reply, request, await transfers.merge(requireAuth(request), request.body))
  );

  server.get(
    exportPlaylist.path,
    {
      schema: {
        ...contractSchema(exportPlaylist),
        params: exportPlaylist.params,
        querystring: exportPlaylist.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await portability.export(request.user ?? null, request.params.id, request.query.format)
      )
  );

  server.post(
    importPlaylist.path,
    {
      bodyLimit: IMPORT_BODY_LIMIT,
      schema: {
        ...contractSchema(importPlaylist),
        params: importPlaylist.params,
        body: importPlaylist.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await portability.import(requireAuth(request), request.params.id, request.body)
      )
  );
}
