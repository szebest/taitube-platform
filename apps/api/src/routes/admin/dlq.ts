import type { JobQueue, Repositories } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth';
import { problemResponse } from '../../schemas/problem';
import { DlqService } from '../../services/dlq-service';

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

    // 1. GET /admin/dlq?cursor=&limit=&status=
    server.get(
      prefix,
      {
        schema: {
          tags: ['Admin'],
          summary: 'List DLQ entries',
          description:
            'Lists dead-letter queue entries from Postgres mirror with cursor pagination.',
          querystring: z.object({
            cursor: z.string().optional().describe('Pagination cursor'),
            limit: z.coerce.number().min(1).max(100).optional().describe('Items per page'),
            status: z
              .enum(['PARKED', 'REPLAYED', 'DISCARDED'])
              .optional()
              .describe('DLQ status filter'),
          }),
          response: {
            200: z.object({
              items: z.array(
                z.object({
                  id: z.string(),
                  queue: z.string(),
                  jobId: z.string(),
                  videoId: z.string().nullable().optional(),
                  payload: z.unknown().optional(),
                  errorCode: z.string().nullable().optional(),
                  errorMessage: z.string().nullable().optional(),
                  stack: z.string().nullable().optional(),
                  attemptsMade: z.number(),
                  workerId: z.string().nullable().optional(),
                  status: z.string(),
                  createdAt: z.union([z.string(), z.date()]),
                  replayedAt: z.union([z.string(), z.date()]).nullable().optional(),
                })
              ),
              nextCursor: z.string().nullable().optional(),
            }),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { cursor, limit, status } = request.query;
        const result = await dlqService.list({ cursor, limit, status });
        return reply.status(200).send(result);
      }
    );

    // 2. POST /admin/dlq/:id/replay
    server.post(
      `${prefix}/:id/replay`,
      {
        schema: {
          tags: ['Admin'],
          summary: 'Replay DLQ job',
          description:
            'Re-enqueues dead-letter job into its origin queue with fresh suffix --r{n}.',
          params: z.object({
            id: z.string().describe('DLQ entry ID'),
          }),
          body: z
            .object({
              resetAttempts: z.boolean().optional().describe('Reset retry attempts to 0'),
              force: z.boolean().optional().describe('Force replay even if already processed'),
            })
            .nullish(),
          response: {
            202: z.object({
              status: z.literal('REPLAYED'),
              dlqEntryId: z.string(),
              replayJobId: z.string(),
            }),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation failed'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
            404: problemResponse([ErrorCodes.DLQ_ENTRY_NOT_FOUND], 'DLQ entry not found'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { id } = request.params;
        const result = await dlqService.replay(id);
        return reply.status(202).send(result);
      }
    );

    // 3. DELETE /admin/dlq/:id
    server.delete(
      `${prefix}/:id`,
      {
        schema: {
          tags: ['Admin'],
          summary: 'Discard DLQ job',
          description: 'Marks a dead-letter queue job as DISCARDED.',
          params: z.object({
            id: z.string().describe('DLQ entry ID'),
          }),
          response: {
            204: z.null().describe('DLQ entry discarded'),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation failed'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
            404: problemResponse([ErrorCodes.DLQ_ENTRY_NOT_FOUND], 'DLQ entry not found'),
          },
          ...(isAlias ? { hide: true } : {}),
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
