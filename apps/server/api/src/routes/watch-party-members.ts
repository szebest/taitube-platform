import {
  banWatchPartyMember,
  kickWatchPartyMember,
  removeWatchPartyGuests,
  transferWatchPartyOwnership,
  unbanWatchPartyMember,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartyMembersRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyMemberService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    kickWatchPartyMember.path,
    { schema: { ...contractSchema(kickWatchPartyMember), params: kickWatchPartyMember.params } },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyMemberService.kick(id, partyCallerOf(request), memberKey),
        { status: kickWatchPartyMember.status }
      );
    }
  );

  server.post(
    removeWatchPartyGuests.path,
    {
      schema: { ...contractSchema(removeWatchPartyGuests), params: removeWatchPartyGuests.params },
    },
    async (request, reply) => {
      requireAuth(request);
      return sendResult(
        reply,
        request,
        await watchPartyMemberService.removeGuests(request.params.id, partyCallerOf(request)),
        { status: removeWatchPartyGuests.status }
      );
    }
  );

  server.put(
    banWatchPartyMember.path,
    {
      schema: {
        ...contractSchema(banWatchPartyMember),
        params: banWatchPartyMember.params,
        body: banWatchPartyMember.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyMemberService.ban(id, partyCallerOf(request), memberKey, request.body),
        { status: banWatchPartyMember.status }
      );
    }
  );

  server.delete(
    unbanWatchPartyMember.path,
    { schema: { ...contractSchema(unbanWatchPartyMember), params: unbanWatchPartyMember.params } },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyMemberService.unban(id, partyCallerOf(request), memberKey),
        { status: unbanWatchPartyMember.status }
      );
    }
  );

  server.post(
    transferWatchPartyOwnership.path,
    {
      schema: {
        ...contractSchema(transferWatchPartyOwnership),
        params: transferWatchPartyOwnership.params,
        body: transferWatchPartyOwnership.body,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      return sendResult(
        reply,
        request,
        await watchPartyMemberService.transferOwner(
          request.params.id,
          partyCallerOf(request),
          request.body
        )
      );
    }
  );
}
