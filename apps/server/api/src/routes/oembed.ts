import { getOEmbed } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function oembedRoutes(app: FastifyInstance): Promise<void> {
  const { oembedService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getOEmbed.path,
    { schema: { ...contractSchema(getOEmbed), querystring: getOEmbed.query } },
    async (request, reply) => sendResult(reply, request, await oembedService.embed(request.query))
  );
}
