import { getBootstrap } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function bootstrapRoutes(app: FastifyInstance): Promise<void> {
  const { bootstrapService } = app.services;

  app
    .withTypeProvider<ZodTypeProvider>()
    .get(getBootstrap.path, { schema: contractSchema(getBootstrap) }, async (request, reply) =>
      sendResult(reply, request, await bootstrapService.contextFor(request.user))
    );
}
