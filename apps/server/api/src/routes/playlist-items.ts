import {
  addPlaylistSection,
  editPlaylistItem,
  listPlaylistActivity,
  listPlaylistItems,
  removePlaylistSection,
  restorePlaylistActivity,
  SHARE_TOKEN_PARAM,
  sortPlaylist,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function playlistItemsRoutes(app: FastifyInstance): Promise<void> {
  const { playlistItemService: items, playlistActivityService: activity } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listPlaylistItems.path,
    {
      schema: {
        ...contractSchema(listPlaylistItems),
        params: listPlaylistItems.params,
        querystring: listPlaylistItems.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await items.list(request.user ?? null, request.params.id, {
          ...request.query,
          shareToken: request.query[SHARE_TOKEN_PARAM] ?? null,
        })
      )
  );

  server.patch(
    editPlaylistItem.path,
    {
      schema: {
        ...contractSchema(editPlaylistItem),
        params: editPlaylistItem.params,
        body: editPlaylistItem.body,
      },
    },
    async (request, reply) => {
      const { id, itemId } = request.params;
      const edited = await items.edit(requireAuth(request), id, itemId, request.body);
      return sendResult(reply, request, edited, { status: editPlaylistItem.status });
    }
  );

  server.post(
    addPlaylistSection.path,
    {
      schema: {
        ...contractSchema(addPlaylistSection),
        params: addPlaylistSection.params,
        body: addPlaylistSection.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await items.addSection(requireAuth(request), request.params.id, request.body.title),
        { status: addPlaylistSection.status }
      )
  );

  server.delete(
    removePlaylistSection.path,
    { schema: { ...contractSchema(removePlaylistSection), params: removePlaylistSection.params } },
    async (request, reply) => {
      const { id, itemId } = request.params;
      const removed = await items.removeSection(requireAuth(request), id, itemId);
      return sendResult(reply, request, removed, { status: removePlaylistSection.status });
    }
  );

  server.post(
    sortPlaylist.path,
    {
      schema: {
        ...contractSchema(sortPlaylist),
        params: sortPlaylist.params,
        body: sortPlaylist.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await items.sort(requireAuth(request), request.params.id, request.body.sort),
        { status: sortPlaylist.status }
      )
  );

  server.get(
    listPlaylistActivity.path,
    {
      schema: {
        ...contractSchema(listPlaylistActivity),
        params: listPlaylistActivity.params,
        querystring: listPlaylistActivity.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await activity.list(requireAuth(request), request.params.id, request.query)
      )
  );

  server.post(
    restorePlaylistActivity.path,
    {
      schema: {
        ...contractSchema(restorePlaylistActivity),
        params: restorePlaylistActivity.params,
      },
    },
    async (request, reply) => {
      const { id, activityId } = request.params;
      const restored = await activity.restore(requireAuth(request), id, activityId);
      return sendResult(reply, request, restored, { status: restorePlaylistActivity.status });
    }
  );
}
