import { authorizeLiveIngest } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function liveIngestRoutes(app: FastifyInstance): Promise<void> {
  const { liveIngestService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    authorizeLiveIngest.path,
    {
      schema: {
        ...contractSchema(authorizeLiveIngest),
        querystring: authorizeLiveIngest.query,
        body: authorizeLiveIngest.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await liveIngestService.authorize({
          presentedSecret: request.query.secret,
          call: request.body,
          requestId: request.id,
        }),
        { status: authorizeLiveIngest.status }
      )
  );
}
