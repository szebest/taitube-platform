import { listWatchParties } from '@vp/api-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function watchPartyDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyDiscoveryService } = app.services;
  const { listPerMinute } = app.config.watchParties.discovery;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listWatchParties.path,
    {
      config: {
        rateLimit: {
          max: listPerMinute,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
        },
      },
      schema: { ...contractSchema(listWatchParties), querystring: listWatchParties.query },
    },
    async (request, reply) =>
      sendResult(reply, request, await watchPartyDiscoveryService.list(request.user, request.query))
  );
}
