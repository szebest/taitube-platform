import { discardDlqEntry, listDlq, replayDlqEntry } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractPaths, contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';

export async function adminDlqRoutes(app: FastifyInstance): Promise<void> {
  const { dlqService } = app.services;

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listDlq)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listDlq, { hide }),
          querystring: listDlq.query,
        },
      },
      async (request, reply) => {
        const { cursor, limit, status } = request.query;

        return sendResult(
          reply,
          request,
          await dlqService.list(request.user, { cursor, limit, status })
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(replayDlqEntry)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(replayDlqEntry, { hide }),
          params: replayDlqEntry.params,
          body: replayDlqEntry.body,
        },
      },
      async (request, reply) => {
        const { id } = request.params;

        return sendResult(reply, request, await dlqService.replay(request.user, id), {
          status: 202,
        });
      }
    );
  }

  for (const { path, hide } of contractPaths(discardDlqEntry)) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(discardDlqEntry, { hide }),
          params: discardDlqEntry.params,
        },
      },
      async (request, reply) => {
        const { id } = request.params;

        return sendResult(reply, request, await dlqService.discard(request.user, id), {
          status: 204,
        });
      }
    );
  }
}
