import {
  createLiveChatTicket,
  getLiveChatReplay,
  getLiveOverlay,
  getLiveStream,
  listLiveStreams,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function liveRoutes(app: FastifyInstance): Promise<void> {
  const { liveService, liveChatService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listLiveStreams.path,
    { schema: { ...contractSchema(listLiveStreams), querystring: listLiveStreams.query } },
    async (request, reply) =>
      sendResult(reply, request, await liveService.list(request.query?.limit))
  );

  server.get(
    getLiveStream.path,
    { schema: { ...contractSchema(getLiveStream), params: getLiveStream.params } },
    async (request, reply) =>
      sendResult(reply, request, await liveService.get(request.user ?? null, request.params.id))
  );

  server.get(
    getLiveOverlay.path,
    { schema: { ...contractSchema(getLiveOverlay), params: getLiveOverlay.params } },
    async (request, reply) =>
      sendResult(reply, request, await liveService.overlay(request.params.token))
  );

  server.get(
    getLiveChatReplay.path,
    {
      schema: {
        ...contractSchema(getLiveChatReplay),
        params: getLiveChatReplay.params,
        querystring: getLiveChatReplay.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await liveService.replay(request.user ?? null, request.params.id, request.query)
      )
  );

  server.post(
    createLiveChatTicket.path,
    { schema: { ...contractSchema(createLiveChatTicket), params: createLiveChatTicket.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await liveChatService.issueTicket(requireAuth(request), request.params.id),
        { status: createLiveChatTicket.status }
      )
  );
}
