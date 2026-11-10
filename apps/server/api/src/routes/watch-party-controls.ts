import { listWatchPartyControls, putWatchPartyControl } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function watchPartyControlsRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyControlsService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listWatchPartyControls.path,
    {
      schema: {
        ...contractSchema(listWatchPartyControls),
        querystring: listWatchPartyControls.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyControlsService.list(requireAuth(request).id, request.query?.roomId ?? null)
      )
  );

  server.put(
    putWatchPartyControl.path,
    {
      schema: { ...contractSchema(putWatchPartyControl), body: putWatchPartyControl.body },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyControlsService.put(requireAuth(request).id, request.body)
      )
  );
}
