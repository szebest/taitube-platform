import { recordView } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function viewsRoutes(app: FastifyInstance): Promise<void> {
  const { viewService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    recordView.path,
    {
      schema: {
        ...contractSchema(recordView),
        params: recordView.params,
        body: recordView.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await viewService.record({
          videoId: request.params.id,
          viewer: request.user ?? null,
          telemetry: request.body,
        }),
        { status: recordView.status }
      )
  );
}
