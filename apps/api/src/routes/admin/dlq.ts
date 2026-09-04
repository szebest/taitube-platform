import type { JobQueue, Repositories } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { defaultJobOptions, generateReplayJobId, stagePolicies } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.js';

export interface AdminDlqRouteOptions {
  repositories: Repositories;
  queues: Map<string, JobQueue>;
}

export function registerAdminDlqRoutes(app: FastifyInstance, options: AdminDlqRouteOptions): void {
  const { repositories, queues } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  const prefixes = ['/admin/dlq', '/v1/admin/dlq'] as const;

  for (const prefix of prefixes) {
    // GET /admin/dlq?cursor=&limit=&status=
    server.get(
      prefix,
      {
        schema: {
          querystring: z.object({
            cursor: z.string().optional(),
            limit: z.coerce.number().min(1).max(100).optional(),
            status: z.enum(['PARKED', 'REPLAYED', 'DISCARDED']).optional(),
          }),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { cursor, limit, status } = request.query;
        const result = await repositories.dlq.list({ cursor, limit, status });
        return reply.status(200).send(result);
      }
    );

    // POST /admin/dlq/:id/replay
    server.post(
      `${prefix}/:id/replay`,
      {
        schema: {
          params: z.object({
            id: z.string(),
          }),
          body: z
            .object({
              resetAttempts: z.boolean().optional(),
              force: z.boolean().optional(),
            })
            .nullish(),
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

    // DELETE /admin/dlq/:id
    server.delete(
      `${prefix}/:id`,
      {
        schema: {
          params: z.object({
            id: z.string(),
          }),
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

        return reply.status(204).send();
      }
    );
  }
}
