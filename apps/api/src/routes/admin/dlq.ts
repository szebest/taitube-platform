import { discardDlqEntry, listDlq, replayDlqEntry } from '@vp/api-contracts';
import type { JobQueue, Repositories } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAdmin } from '../../plugins/auth';
import { DlqService } from '../../services/dlq-service';
import { contractSchema } from '../contract-schema';

export interface AdminDlqRouteOptions {
  repositories?: Repositories;
  queues?: Map<string, JobQueue>;
  dlqService?: DlqService;
}

/**
 * Fastify routes plugin for Admin DLQ inspection, replay, and discarding.
 * Thin transport adapter delegating DLQ operations to DlqService.
 */
export function registerAdminDlqRoutes(app: FastifyInstance, options: AdminDlqRouteOptions): void {
  const dlqService =
    options.dlqService ??
    (options.repositories && options.queues
      ? new DlqService({
          dlq: options.repositories.dlq,
          events: options.repositories.events,
          queues: options.queues,
        })
      : undefined);

  if (!dlqService) {
    throw new Error('registerAdminDlqRoutes requires either dlqService or repositories + queues');
  }

  const server = app.withTypeProvider<ZodTypeProvider>();

  const prefixes = ['/admin/dlq', '/v1/admin/dlq'] as const;

  for (const prefix of prefixes) {
    const isAlias = prefix === '/admin/dlq';

    server.get(
      prefix,
      {
        schema: {
          ...contractSchema(listDlq, { hide: isAlias }),
          querystring: listDlq.query,
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { cursor, limit, status } = request.query;
        const result = await dlqService.list({ cursor, limit, status });
        return reply.status(200).send(result);
      }
    );

    server.post(
      `${prefix}/:id/replay`,
      {
        schema: {
          ...contractSchema(replayDlqEntry, { hide: isAlias }),
          params: replayDlqEntry.params,
          body: replayDlqEntry.body,
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { id } = request.params;
        const result = await dlqService.replay(id);
        return reply.status(202).send(result);
      }
    );

    server.delete(
      `${prefix}/:id`,
      {
        schema: {
          ...contractSchema(discardDlqEntry, { hide: isAlias }),
          params: discardDlqEntry.params,
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { id } = request.params;
        await dlqService.discard(id);
        return reply.status(204).send(null);
      }
    );
  }
}
