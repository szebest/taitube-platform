import {
  getMyLiveStream,
  openMyLiveStream,
  stopMyLiveStream,
  updateMyLiveStream,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function creatorLiveRoutes(app: FastifyInstance): Promise<void> {
  const { creatorLiveService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    openMyLiveStream.path,
    { schema: contractSchema(openMyLiveStream) },
    async (request, reply) =>
      sendResult(reply, request, await creatorLiveService.open(requireAuth(request)))
  );

  server.get(
    getMyLiveStream.path,
    { schema: contractSchema(getMyLiveStream) },
    async (request, reply) =>
      sendResult(reply, request, await creatorLiveService.current(requireAuth(request)))
  );

  server.patch(
    updateMyLiveStream.path,
    {
      schema: {
        ...contractSchema(updateMyLiveStream),
        params: updateMyLiveStream.params,
        body: updateMyLiveStream.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await creatorLiveService.update(requireAuth(request), request.params.id, request.body)
      )
  );

  server.post(
    stopMyLiveStream.path,
    { schema: { ...contractSchema(stopMyLiveStream), params: stopMyLiveStream.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await creatorLiveService.stop(requireAuth(request), request.params.id),
        { status: stopMyLiveStream.status }
      )
  );
}
