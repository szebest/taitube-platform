import type { JobQueue, Repositories } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { defaultJobOptions, generateReplayJobId, stagePolicies } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.js';
import { problemResponse } from '../../schemas/problem.js';

export interface AdminDlqRouteOptions {
  repositories: Repositories;
  queues: Map<string, JobQueue>;
}

export function registerAdminDlqRoutes(app: FastifyInstance, options: AdminDlqRouteOptions): void {
  const { repositories, queues } = options;
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
        const result = await repositories.dlq.list({ cursor, limit, status });
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
        const entry = await repositories.dlq.findById(id);
        if (!entry) {
          throw new PermanentError(ErrorCodes.DLQ_ENTRY_NOT_FOUND, `DLQ entry "${id}" not found`);
        }

        const targetQueue = queues.get(entry.queue);
        if (!targetQueue) {
          throw new PermanentError(
            ErrorCodes.INTERNAL,
            `Target queue "${entry.queue}" is not available for replay`
          );
        }

        const replayJobId = generateReplayJobId(entry.jobId);
        const stageOpts =
          entry.queue in stagePolicies
            ? stagePolicies[entry.queue as keyof typeof stagePolicies]
            : {};

        await targetQueue.add(entry.queue, entry.payload, {
          jobId: replayJobId,
          ...stageOpts,
          ...defaultJobOptions,
        });

        await repositories.dlq.updateStatus(id, 'REPLAYED', { replayedAt: new Date() });

        if (entry.videoId) {
          await repositories.events.create({
            videoId: entry.videoId,
            type: 'dlq.replayed',
            payload: {
              dlqEntryId: id,
              originQueue: entry.queue,
              originalJobId: entry.jobId,
              replayJobId,
            },
          });
        }

        return reply.status(202).send({
          status: 'REPLAYED',
          dlqEntryId: id,
          replayJobId,
        });
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
        const entry = await repositories.dlq.findById(id);
        if (!entry) {
          throw new PermanentError(ErrorCodes.DLQ_ENTRY_NOT_FOUND, `DLQ entry "${id}" not found`);
        }

        await repositories.dlq.updateStatus(id, 'DISCARDED');

        if (entry.videoId) {
          await repositories.events.create({
            videoId: entry.videoId,
            type: 'dlq.discarded',
            payload: {
              dlqEntryId: id,
              originQueue: entry.queue,
              originalJobId: entry.jobId,
            },
          });
        }

        return reply.status(204).send(null);
      }
    );
  }
}
