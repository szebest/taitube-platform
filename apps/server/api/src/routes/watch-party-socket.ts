import { createWatchPartySocketTicket } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartySocketRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createWatchPartySocketTicket.path,
    {
      schema: {
        ...contractSchema(createWatchPartySocketTicket),
        params: createWatchPartySocketTicket.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyService.socketTicket(request.params.id, partyCallerOf(request)),
        { status: createWatchPartySocketTicket.status }
      )
  );
}
