import { discardDlqEntry, listDlq, replayDlqEntry } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { DlqService } from '../../services/dlq-service';
import { contractPaths, contractSchema } from '../contract-schema';

export interface AdminDlqRouteOptions {
  dlqService: DlqService;
}

/**
 * Fastify routes plugin for Admin DLQ inspection, replay, and discarding.
 * Thin transport adapter delegating DLQ operations to DlqService.
 */
export function registerAdminDlqRoutes(app: FastifyInstance, options: AdminDlqRouteOptions): void {
  const { dlqService } = options;

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
        const result = await dlqService.list(request.user, { cursor, limit, status });
        return reply.status(200).send(result);
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
        const result = await dlqService.replay(request.user, id);
        return reply.status(202).send(result);
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
        await dlqService.discard(request.user, id);
        return reply.status(204).send(null);
      }
    );
  }
}
