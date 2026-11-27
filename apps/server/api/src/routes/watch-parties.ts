import {
  closeWatchParty,
  createWatchParty,
  getWatchParty,
  getWatchPartyRoster,
  joinWatchParty,
  leaveWatchParty,
  listMyWatchParties,
  problemFor,
  updateWatchParty,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartiesRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createWatchParty.path,
    { schema: { ...contractSchema(createWatchParty), body: createWatchParty.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.create(partyCallerOf(request), request.body),
        {
          status: createWatchParty.status,
          headers: (failure): Record<string, string> =>
            failure.code === ErrorCodes.RATE_LIMITED
              ? { 'retry-after': String(failure.retryAfterSeconds) }
              : {},
        }
      )
  );

  server.get(
    listMyWatchParties.path,
    { schema: contractSchema(listMyWatchParties) },
    async (request, reply) =>
      sendResult(reply, request, await watchPartyService.listMine(partyCallerOf(request)))
  );

  server.get(
    getWatchParty.path,
    {
      schema: {
        ...contractSchema(getWatchParty),
        params: getWatchParty.params,
        querystring: getWatchParty.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.get(
          request.params.id,
          partyCallerOf(request),
          request.query?.invite
        )
      )
  );

  server.patch(
    updateWatchParty.path,
    {
      schema: {
        ...contractSchema(updateWatchParty),
        params: updateWatchParty.params,
        body: updateWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.update(request.params.id, partyCallerOf(request), request.body)
      )
  );

  server.post(
    closeWatchParty.path,
    {
      schema: {
        ...contractSchema(closeWatchParty),
        params: closeWatchParty.params,
        body: closeWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.close(request.params.id, partyCallerOf(request))
      )
  );

  server.post(
    joinWatchParty.path,
    {
      schema: {
        ...contractSchema(joinWatchParty),
        params: joinWatchParty.params,
        body: joinWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.join(request.params.id, partyCallerOf(request), request.body),
        {
          on: {
            WATCH_PARTY_FULL: (failure) =>
              problemFor(failure, request.url, {
                errors: [{ present: failure.present, capacity: failure.capacity }],
              }),
          },
          headers: (failure): Record<string, string> =>
            failure.code === ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED
              ? { 'retry-after': String(failure.retryAfterSeconds) }
              : {},
        }
      )
  );

  server.post(
    leaveWatchParty.path,
    { schema: { ...contractSchema(leaveWatchParty), params: leaveWatchParty.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.leave(request.params.id, partyCallerOf(request)),
        { status: leaveWatchParty.status }
      )
  );

  server.get(
    getWatchPartyRoster.path,
    { schema: { ...contractSchema(getWatchPartyRoster), params: getWatchPartyRoster.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.roster(request.params.id, partyCallerOf(request))
      )
  );
}
