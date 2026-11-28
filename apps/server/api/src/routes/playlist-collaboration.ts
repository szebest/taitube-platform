import {
  acceptPlaylistInvite,
  changePlaylistCollaboratorRole,
  createPlaylistInviteLink,
  declinePlaylistInvite,
  invitePlaylistCollaborator,
  leavePlaylist,
  listPlaylistCollaborators,
  listPlaylistInvites,
  removePlaylistCollaborator,
  revokePlaylistInvite,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function playlistCollaborationRoutes(app: FastifyInstance): Promise<void> {
  const { playlistCollaborationService: collaboration } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listPlaylistCollaborators.path,
    {
      schema: {
        ...contractSchema(listPlaylistCollaborators),
        params: listPlaylistCollaborators.params,
      },
    },
    async (request, reply) =>
      sendResult(reply, request, await collaboration.list(requireAuth(request), request.params.id))
  );

  server.post(
    invitePlaylistCollaborator.path,
    {
      schema: {
        ...contractSchema(invitePlaylistCollaborator),
        params: invitePlaylistCollaborator.params,
        body: invitePlaylistCollaborator.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.invite(requireAuth(request), request.params.id, request.body),
        { status: invitePlaylistCollaborator.status }
      )
  );

  server.delete(
    leavePlaylist.path,
    { schema: { ...contractSchema(leavePlaylist), params: leavePlaylist.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.leave(requireAuth(request), request.params.id),
        {
          status: leavePlaylist.status,
        }
      )
  );

  server.patch(
    changePlaylistCollaboratorRole.path,
    {
      schema: {
        ...contractSchema(changePlaylistCollaboratorRole),
        params: changePlaylistCollaboratorRole.params,
        body: changePlaylistCollaboratorRole.body,
      },
    },
    async (request, reply) => {
      const { id, userId } = request.params;
      const changed = await collaboration.changeRole(
        requireAuth(request),
        id,
        userId,
        request.body.role
      );
      return sendResult(reply, request, changed, { status: changePlaylistCollaboratorRole.status });
    }
  );

  server.delete(
    removePlaylistCollaborator.path,
    {
      schema: {
        ...contractSchema(removePlaylistCollaborator),
        params: removePlaylistCollaborator.params,
      },
    },
    async (request, reply) => {
      const { id, userId } = request.params;
      const removed = await collaboration.remove(requireAuth(request), id, userId);
      return sendResult(reply, request, removed, { status: removePlaylistCollaborator.status });
    }
  );

  server.post(
    createPlaylistInviteLink.path,
    {
      schema: {
        ...contractSchema(createPlaylistInviteLink),
        params: createPlaylistInviteLink.params,
        body: createPlaylistInviteLink.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.createLink(requireAuth(request), request.params.id, request.body),
        { status: createPlaylistInviteLink.status }
      )
  );

  server.get(
    listPlaylistInvites.path,
    { schema: { ...contractSchema(listPlaylistInvites), params: listPlaylistInvites.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.listInvites(requireAuth(request), request.params.id)
      )
  );

  server.delete(
    revokePlaylistInvite.path,
    { schema: { ...contractSchema(revokePlaylistInvite), params: revokePlaylistInvite.params } },
    async (request, reply) => {
      const { id, inviteId } = request.params;
      const revoked = await collaboration.revokeInvite(requireAuth(request), id, inviteId);
      return sendResult(reply, request, revoked, { status: revokePlaylistInvite.status });
    }
  );

  server.post(
    acceptPlaylistInvite.path,
    { schema: { ...contractSchema(acceptPlaylistInvite), params: acceptPlaylistInvite.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.accept(requireAuth(request), request.params.token)
      )
  );

  server.post(
    declinePlaylistInvite.path,
    { schema: { ...contractSchema(declinePlaylistInvite), params: declinePlaylistInvite.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await collaboration.decline(requireAuth(request), request.params.token),
        { status: declinePlaylistInvite.status }
      )
  );
}
