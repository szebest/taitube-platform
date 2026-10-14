import {
  clearWatchHistory,
  getWatchProgress,
  listWatchHistory,
  recordWatchProgress,
  removeWatchHistoryEntry,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function watchHistoryRoutes(app: FastifyInstance): Promise<void> {
  const { watchHistoryService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    recordWatchProgress.path,
    { schema: { ...contractSchema(recordWatchProgress), body: recordWatchProgress.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchHistoryService.record(requireAuth(request), request.body)
      )
  );

  server.get(
    listWatchHistory.path,
    { schema: { ...contractSchema(listWatchHistory), querystring: listWatchHistory.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchHistoryService.list(requireAuth(request), request.query)
      )
  );

  server.get(
    getWatchProgress.path,
    { schema: { ...contractSchema(getWatchProgress), params: getWatchProgress.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchHistoryService.playhead(requireAuth(request), request.params.videoId)
      )
  );

  server.delete(
    clearWatchHistory.path,
    { schema: contractSchema(clearWatchHistory) },
    async (request, reply) =>
      sendResult(reply, request, await watchHistoryService.clear(requireAuth(request)), {
        status: clearWatchHistory.status,
      })
  );

  server.delete(
    removeWatchHistoryEntry.path,
    {
      schema: {
        ...contractSchema(removeWatchHistoryEntry),
        params: removeWatchHistoryEntry.params,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchHistoryService.remove(requireAuth(request), request.params.videoId),
        { status: removeWatchHistoryEntry.status }
      )
  );
}
