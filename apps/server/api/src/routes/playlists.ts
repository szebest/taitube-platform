import {
  addPlaylistItem,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listMyPlaylists,
  removePlaylistItem,
  reorderPlaylist,
  SHARE_TOKEN_PARAM,
  updatePlaylist,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { viewerSessionOf } from './video-access-request';

export async function playlistsRoutes(app: FastifyInstance): Promise<void> {
  const { playlistService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createPlaylist.path,
    { schema: { ...contractSchema(createPlaylist), body: createPlaylist.body } },
    async (request, reply) =>
      sendResult(reply, request, await playlistService.create(requireAuth(request), request.body), {
        status: createPlaylist.status,
      })
  );

  server.get(
    getPlaylist.path,
    {
      schema: {
        ...contractSchema(getPlaylist),
        params: getPlaylist.params,
        querystring: getPlaylist.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.open(request.user ?? null, request.params.id, {
          shareToken: request.query[SHARE_TOKEN_PARAM] ?? null,
          sessionKey: viewerSessionOf(request),
        })
      )
  );

  server.patch(
    updatePlaylist.path,
    {
      schema: {
        ...contractSchema(updatePlaylist),
        params: updatePlaylist.params,
        body: updatePlaylist.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.update(requireAuth(request), request.params.id, request.body)
      )
  );

  server.delete(
    deletePlaylist.path,
    { schema: { ...contractSchema(deletePlaylist), params: deletePlaylist.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.remove(requireAuth(request), request.params.id),
        { status: deletePlaylist.status }
      )
  );

  server.post(
    addPlaylistItem.path,
    {
      schema: {
        ...contractSchema(addPlaylistItem),
        params: addPlaylistItem.params,
        body: addPlaylistItem.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.addItem(
          requireAuth(request),
          request.params.id,
          request.body.videoId
        ),
        { status: addPlaylistItem.status }
      )
  );

  server.delete(
    removePlaylistItem.path,
    { schema: { ...contractSchema(removePlaylistItem), params: removePlaylistItem.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.removeItem(
          requireAuth(request),
          request.params.id,
          request.params.videoId
        ),
        { status: removePlaylistItem.status }
      )
  );

  server.put(
    reorderPlaylist.path,
    {
      schema: {
        ...contractSchema(reorderPlaylist),
        params: reorderPlaylist.params,
        body: reorderPlaylist.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.reorder(requireAuth(request), request.params.id, request.body)
      )
  );

  server.get(
    listMyPlaylists.path,
    { schema: { ...contractSchema(listMyPlaylists), querystring: listMyPlaylists.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await playlistService.listMine(requireAuth(request), request.query.videoId ?? null)
      )
  );
}
