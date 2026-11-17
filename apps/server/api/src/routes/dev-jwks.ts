import { getDevJwks } from '@kit/dev-token';
import { jwks } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';

export async function devJwksRoutes(app: FastifyInstance): Promise<void> {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(jwks.path, { schema: contractSchema(jwks) }, async (_request, reply) => {
      return reply.status(200).send(getDevJwks());
    });
}
