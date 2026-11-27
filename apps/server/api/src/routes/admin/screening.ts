import {
  approveHeldVideo,
  dismissScreeningFlags,
  listScreeningCases,
  rejectHeldVideo,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../../plugins/auth';
import { contractPaths, contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';

export async function adminScreeningRoutes(app: FastifyInstance): Promise<void> {
  const { screeningService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listScreeningCases)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listScreeningCases, { hide }),
          querystring: listScreeningCases.query,
        },
      },
      async (request, reply) => {
        const moderator = requireAuth(request);
        return sendResult(reply, request, await screeningService.queue(moderator, request.query));
      }
    );
  }

  server.post(
    approveHeldVideo.path,
    {
      schema: { ...contractSchema(approveHeldVideo), params: approveHeldVideo.params },
    },
    async (request, reply) => {
      const moderator = requireAuth(request);
      return sendResult(
        reply,
        request,
        await screeningService.approve(moderator, request.params.id)
      );
    }
  );

  server.post(
    rejectHeldVideo.path,
    {
      schema: {
        ...contractSchema(rejectHeldVideo),
        params: rejectHeldVideo.params,
        body: rejectHeldVideo.body,
      },
    },
    async (request, reply) => {
      const moderator = requireAuth(request);
      return sendResult(
        reply,
        request,
        await screeningService.reject(moderator, request.params.id, request.body.reason)
      );
    }
  );

  server.post(
    dismissScreeningFlags.path,
    {
      schema: { ...contractSchema(dismissScreeningFlags), params: dismissScreeningFlags.params },
    },
    async (request, reply) => {
      const moderator = requireAuth(request);
      return sendResult(
        reply,
        request,
        await screeningService.dismiss(moderator, request.params.id)
      );
    }
  );
}
