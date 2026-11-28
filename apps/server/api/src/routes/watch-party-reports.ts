import {
  adminCloseWatchParty,
  adminRestoreWatchParty,
  clearWatchPartyInterest,
  markWatchPartyInterest,
  reportWatchParty,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartyReportsRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.put(
    markWatchPartyInterest.path,
    {
      schema: {
        ...contractSchema(markWatchPartyInterest),
        params: markWatchPartyInterest.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.setInterest(request.params.id, partyCallerOf(request), true),
        { status: markWatchPartyInterest.status }
      )
  );

  server.delete(
    clearWatchPartyInterest.path,
    {
      schema: {
        ...contractSchema(clearWatchPartyInterest),
        params: clearWatchPartyInterest.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.setInterest(request.params.id, partyCallerOf(request), false),
        { status: clearWatchPartyInterest.status }
      )
  );

  server.post(
    reportWatchParty.path,
    {
      schema: {
        ...contractSchema(reportWatchParty),
        params: reportWatchParty.params,
        body: reportWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.report(request.params.id, partyCallerOf(request), request.body),
        { status: reportWatchParty.status }
      )
  );

  server.post(
    adminCloseWatchParty.path,
    {
      schema: {
        ...contractSchema(adminCloseWatchParty),
        params: adminCloseWatchParty.params,
        body: adminCloseWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.adminClose(request.params.id, partyCallerOf(request))
      )
  );

  server.post(
    adminRestoreWatchParty.path,
    {
      schema: {
        ...contractSchema(adminRestoreWatchParty),
        params: adminRestoreWatchParty.params,
        body: adminRestoreWatchParty.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.adminRestore(request.params.id, partyCallerOf(request))
      )
  );
}
