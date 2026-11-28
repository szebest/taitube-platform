import {
  followPlaylist,
  forkPlaylist,
  freezePlaylist,
  listFollowedPlaylists,
  pinPlaylist,
  unfollowPlaylist,
  unpinPlaylist,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** Pins, follows, forks and frozen copies: what a user keeps of playlists in their library. */
export async function playlistLibraryRoutes(app: FastifyInstance): Promise<void> {
  const { playlistLibraryService: library } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.put(
    pinPlaylist.path,
    { schema: { ...contractSchema(pinPlaylist), params: pinPlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.pin(requireAuth(request), request.params.id), {
        status: pinPlaylist.status,
      })
  );

  server.delete(
    unpinPlaylist.path,
    { schema: { ...contractSchema(unpinPlaylist), params: unpinPlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.unpin(requireAuth(request), request.params.id), {
        status: unpinPlaylist.status,
      })
  );

  server.put(
    followPlaylist.path,
    { schema: { ...contractSchema(followPlaylist), params: followPlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.follow(requireAuth(request), request.params.id), {
        status: followPlaylist.status,
      })
  );

  server.delete(
    unfollowPlaylist.path,
    { schema: { ...contractSchema(unfollowPlaylist), params: unfollowPlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.unfollow(requireAuth(request), request.params.id), {
        status: unfollowPlaylist.status,
      })
  );

  server.get(
    listFollowedPlaylists.path,
    {
      schema: {
        ...contractSchema(listFollowedPlaylists),
        querystring: listFollowedPlaylists.query,
      },
    },
    async (request, reply) =>
      sendResult(reply, request, await library.listFollowed(requireAuth(request), request.query))
  );

  server.post(
    forkPlaylist.path,
    { schema: { ...contractSchema(forkPlaylist), params: forkPlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.fork(requireAuth(request), request.params.id), {
        status: forkPlaylist.status,
      })
  );

  server.post(
    freezePlaylist.path,
    { schema: { ...contractSchema(freezePlaylist), params: freezePlaylist.params } },
    async (request, reply) =>
      sendResult(reply, request, await library.freeze(requireAuth(request), request.params.id), {
        status: freezePlaylist.status,
      })
  );
}
