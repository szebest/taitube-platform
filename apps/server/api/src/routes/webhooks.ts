import { createWebhook, deleteWebhook, listWebhooks } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function webhooksRoutes(app: FastifyInstance): Promise<void> {
  const { webhookService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createWebhook.path,
    { schema: { ...contractSchema(createWebhook), body: createWebhook.body } },
    async (request, reply) =>
      sendResult(reply, request, await webhookService.create(requireAuth(request), request.body), {
        status: createWebhook.status,
      })
  );

  server.get(listWebhooks.path, { schema: contractSchema(listWebhooks) }, async (request, reply) =>
    sendResult(reply, request, await webhookService.list(requireAuth(request)))
  );

  server.delete(
    deleteWebhook.path,
    { schema: { ...contractSchema(deleteWebhook), params: deleteWebhook.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await webhookService.remove(requireAuth(request), request.params.id),
        { status: deleteWebhook.status }
      )
  );
}
