import {
  acceptChannelInvite,
  changeChannelMemberRole,
  createChannelInvite,
  declineChannelInvite,
  getChannelTeam,
  listChannelAudit,
  listMyMemberships,
  removeChannelMember,
  revokeChannelInvite,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelTeamRoutes(app: FastifyInstance): Promise<void> {
  const { channelInviteService, channelMemberService, channelAuditService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getChannelTeam.path,
    { schema: contractSchema(getChannelTeam) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await channelMemberService.team(user, acting));
    }
  );

  server.post(
    createChannelInvite.path,
    { schema: { ...contractSchema(createChannelInvite), body: createChannelInvite.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelInviteService.create(user, acting, request.body),
        {
          status: createChannelInvite.status,
        }
      );
    }
  );

  server.delete(
    revokeChannelInvite.path,
    { schema: { ...contractSchema(revokeChannelInvite), params: revokeChannelInvite.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const revoked = await channelInviteService.revoke(user, acting, request.params.id);
      return sendResult(reply, request, revoked, { status: revokeChannelInvite.status });
    }
  );

  server.post(
    acceptChannelInvite.path,
    { schema: { ...contractSchema(acceptChannelInvite), params: acceptChannelInvite.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await channelInviteService.accept(requireAuth(request), request.params.id)
      )
  );

  server.post(
    declineChannelInvite.path,
    { schema: { ...contractSchema(declineChannelInvite), params: declineChannelInvite.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await channelInviteService.decline(requireAuth(request), request.params.id),
        { status: declineChannelInvite.status }
      )
  );

  server.patch(
    changeChannelMemberRole.path,
    {
      schema: {
        ...contractSchema(changeChannelMemberRole),
        params: changeChannelMemberRole.params,
        body: changeChannelMemberRole.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const { userId } = request.params;
      return sendResult(
        reply,
        request,
        await channelMemberService.changeRole(user, acting, userId, request.body.role)
      );
    }
  );

  server.delete(
    removeChannelMember.path,
    { schema: { ...contractSchema(removeChannelMember), params: removeChannelMember.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const removed = await channelMemberService.remove(user, acting, request.params.userId);
      return sendResult(reply, request, removed, { status: removeChannelMember.status });
    }
  );

  server.get(
    listMyMemberships.path,
    { schema: contractSchema(listMyMemberships) },
    async (request, reply) =>
      sendResult(reply, request, await channelMemberService.memberships(requireAuth(request)))
  );

  server.get(
    listChannelAudit.path,
    { schema: { ...contractSchema(listChannelAudit), querystring: listChannelAudit.query } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelAuditService.list(user, acting, request.query)
      );
    }
  );
}
