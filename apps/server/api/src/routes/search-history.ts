import { clearSearchHistory, listSearchHistory, removeSearchHistoryEntry } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function searchHistoryRoutes(app: FastifyInstance): Promise<void> {
  const { searchHistoryService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listSearchHistory.path,
    { schema: { ...contractSchema(listSearchHistory), querystring: listSearchHistory.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await searchHistoryService.list(requireAuth(request), request.query)
      )
  );

  server.delete(
    clearSearchHistory.path,
    { schema: contractSchema(clearSearchHistory) },
    async (request, reply) =>
      sendResult(reply, request, await searchHistoryService.clear(requireAuth(request)), {
        status: clearSearchHistory.status,
      })
  );

  server.delete(
    removeSearchHistoryEntry.path,
    {
      schema: {
        ...contractSchema(removeSearchHistoryEntry),
        params: removeSearchHistoryEntry.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await searchHistoryService.remove(requireAuth(request), request.params.id),
        { status: removeSearchHistoryEntry.status }
      )
  );
}
