import { createClip, deleteClip, getClip, listMyClips } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function clipsRoutes(app: FastifyInstance): Promise<void> {
  const { clipService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createClip.path,
    {
      schema: {
        ...contractSchema(createClip),
        params: createClip.params,
        body: createClip.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await clipService.create(request.user ?? null, request.params.id, request.body),
        { status: createClip.status }
      )
  );

  server.get(
    getClip.path,
    { schema: { ...contractSchema(getClip), params: getClip.params } },
    async (request, reply) =>
      sendResult(reply, request, await clipService.get(request.user ?? null, request.params.id))
  );

  server.get(
    listMyClips.path,
    { schema: { ...contractSchema(listMyClips), querystring: listMyClips.query } },
    async (request, reply) =>
      sendResult(reply, request, await clipService.listMine(requireAuth(request), request.query))
  );

  server.delete(
    deleteClip.path,
    { schema: { ...contractSchema(deleteClip), params: deleteClip.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await clipService.remove(request.user ?? null, request.params.id),
        {
          status: deleteClip.status,
        }
      )
  );
}
