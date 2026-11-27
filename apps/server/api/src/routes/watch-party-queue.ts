import {
  addToWatchPartyQueue,
  getWatchPartyQueue,
  moveWatchPartyQueueItem,
  removeWatchPartyQueueItem,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

export async function watchPartyQueueRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyQueueService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getWatchPartyQueue.path,
    { schema: { ...contractSchema(getWatchPartyQueue), params: getWatchPartyQueue.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyQueueService.list(request.params.id, partyCallerOf(request))
      )
  );

  server.post(
    addToWatchPartyQueue.path,
    {
      schema: {
        ...contractSchema(addToWatchPartyQueue),
        params: addToWatchPartyQueue.params,
        body: addToWatchPartyQueue.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyQueueService.add(request.params.id, partyCallerOf(request), request.body),
        { status: addToWatchPartyQueue.status }
      )
  );

  server.patch(
    moveWatchPartyQueueItem.path,
    {
      schema: {
        ...contractSchema(moveWatchPartyQueueItem),
        params: moveWatchPartyQueueItem.params,
        body: moveWatchPartyQueueItem.body,
      },
    },
    async (request, reply) => {
      const { id, itemId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyQueueService.move(id, partyCallerOf(request), itemId, request.body)
      );
    }
  );

  server.delete(
    removeWatchPartyQueueItem.path,
    {
      schema: {
        ...contractSchema(removeWatchPartyQueueItem),
        params: removeWatchPartyQueueItem.params,
      },
    },
    async (request, reply) => {
      const { id, itemId } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyQueueService.remove(id, partyCallerOf(request), itemId),
        { status: removeWatchPartyQueueItem.status }
      );
    }
  );
}
