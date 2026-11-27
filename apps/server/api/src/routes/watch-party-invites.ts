import {
  createWatchPartyInviteLink,
  declineWatchPartyInvite,
  inviteToWatchParty,
  listWatchPartyInviteCandidates,
  listWatchPartyInviteLinks,
  listWatchPartyInvites,
  problemFor,
  revokeWatchPartyInvite,
  revokeWatchPartyInviteLink,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import type { AccountCaller } from '../services/watch-party/watch-party-invite-service';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

const NO_HEADERS: Readonly<Record<string, string>> = {};

function accountCallerOf(request: FastifyRequest): AccountCaller {
  return { ...partyCallerOf(request), user: requireAuth(request) };
}

export async function watchPartyInvitesRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyInviteService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    inviteToWatchParty.path,
    {
      schema: {
        ...contractSchema(inviteToWatchParty),
        params: inviteToWatchParty.params,
        body: inviteToWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.invite(
          request.params.id,
          accountCallerOf(request),
          request.body
        ),
        {
          status: inviteToWatchParty.status,
          headers: (failure) =>
            failure.code === ErrorCodes.RATE_LIMITED
              ? { 'retry-after': String(failure.retryAfterSeconds) }
              : NO_HEADERS,
        }
      )
  );

  server.get(
    listWatchPartyInvites.path,
    { schema: { ...contractSchema(listWatchPartyInvites), params: listWatchPartyInvites.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.list(request.params.id, accountCallerOf(request))
      )
  );

  server.delete(
    revokeWatchPartyInvite.path,
    {
      schema: { ...contractSchema(revokeWatchPartyInvite), params: revokeWatchPartyInvite.params },
    },
    async (request, reply) => {
      const { id, inviteId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyInviteService.revoke(id, accountCallerOf(request), inviteId),
        { status: revokeWatchPartyInvite.status }
      );
    }
  );

  server.post(
    declineWatchPartyInvite.path,
    {
      schema: {
        ...contractSchema(declineWatchPartyInvite),
        params: declineWatchPartyInvite.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.decline(requireAuth(request), request.params.inviteId),
        {
          status: declineWatchPartyInvite.status,
          on: {
            WATCH_PARTY_INVITE_INVALID: (failure) => ({
              ...problemFor(failure, request.url),
              status: 404,
            }),
          },
        }
      )
  );

  server.post(
    createWatchPartyInviteLink.path,
    {
      schema: {
        ...contractSchema(createWatchPartyInviteLink),
        params: createWatchPartyInviteLink.params,
        body: createWatchPartyInviteLink.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.createLink(
          request.params.id,
          partyCallerOf(request),
          request.body
        ),
        { status: createWatchPartyInviteLink.status }
      )
  );

  server.get(
    listWatchPartyInviteLinks.path,
    {
      schema: {
        ...contractSchema(listWatchPartyInviteLinks),
        params: listWatchPartyInviteLinks.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.listLinks(request.params.id, accountCallerOf(request))
      )
  );

  server.delete(
    revokeWatchPartyInviteLink.path,
    {
      schema: {
        ...contractSchema(revokeWatchPartyInviteLink),
        params: revokeWatchPartyInviteLink.params,
      },
    },
    async (request, reply) => {
      const { id, linkId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyInviteService.revokeLink(id, accountCallerOf(request), linkId),
        { status: revokeWatchPartyInviteLink.status }
      );
    }
  );

  server.get(
    listWatchPartyInviteCandidates.path,
    {
      schema: {
        ...contractSchema(listWatchPartyInviteCandidates),
        params: listWatchPartyInviteCandidates.params,
        querystring: listWatchPartyInviteCandidates.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyInviteService.candidates(
          request.params.id,
          accountCallerOf(request),
          request.query?.q
        ),
        {
          on: {
            VALIDATION_FAILED: (failure) => ({
              ...problemFor(failure, request.url),
              status: 400,
            }),
          },
        }
      )
  );
}
