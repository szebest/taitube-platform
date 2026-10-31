import { cancelPick, createPick, listAdminPicks, updatePick } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';

export async function adminPicksRoutes(app: FastifyInstance): Promise<void> {
  const { pickService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listAdminPicks.path,
    { schema: { ...contractSchema(listAdminPicks), querystring: listAdminPicks.query } },
    async (request, reply) =>
      sendResult(reply, request, await pickService.list(request.user, request.query))
  );

  server.post(
    createPick.path,
    { schema: { ...contractSchema(createPick), body: createPick.body } },
    async (request, reply) =>
      sendResult(reply, request, await pickService.create(request.user, request.body), {
        status: createPick.status,
      })
  );

  server.patch(
    updatePick.path,
    {
      schema: { ...contractSchema(updatePick), params: updatePick.params, body: updatePick.body },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await pickService.update(request.user, request.params.id, request.body)
      )
  );

  server.delete(
    cancelPick.path,
    { schema: { ...contractSchema(cancelPick), params: cancelPick.params } },
    async (request, reply) =>
      sendResult(reply, request, await pickService.cancel(request.user, request.params.id), {
        status: cancelPick.status,
      })
  );
}
