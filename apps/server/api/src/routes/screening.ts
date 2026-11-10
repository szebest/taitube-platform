import { appealScreening, getVideoScreening } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function screeningRoutes(app: FastifyInstance): Promise<void> {
  const { screeningService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(getVideoScreening)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getVideoScreening, { hide }),
          params: getVideoScreening.params,
        },
      },
      async (request, reply) => {
        const owner = requireAuth(request);
        return sendResult(
          reply,
          request,
          await screeningService.ownScreening(owner, request.params.id)
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(appealScreening)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(appealScreening, { hide }),
          params: appealScreening.params,
          body: appealScreening.body,
        },
      },
      async (request, reply) => {
        const owner = requireAuth(request);
        return sendResult(
          reply,
          request,
          await screeningService.appeal(owner, request.params.id, request.body.message),
          { status: 201 }
        );
      }
    );
  }
}
