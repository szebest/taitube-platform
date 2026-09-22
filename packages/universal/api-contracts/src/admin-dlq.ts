import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';
import { CursorSchema, PageLimitSchema } from './pagination.js';

export const DLQ_STATUSES = ['PARKED', 'REPLAYED', 'DISCARDED'] as const;

export const DlqEntrySchema = z.object({
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
});

export const DlqIdParamSchema = z.object({
  id: z.string().describe('DLQ entry ID'),
});

export const ListDlqQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema.optional(),
  status: z.enum(DLQ_STATUSES).optional().describe('DLQ status filter'),
});

export const listDlq = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/dlq',
  tag: 'Admin',
  summary: 'List DLQ entries',
  description: 'Lists dead-letter queue entries from Postgres mirror with cursor pagination.',
  query: ListDlqQuerySchema,
  status: 200,
  result: z.object({
    items: z.array(DlqEntrySchema),
    nextCursor: z.string().nullable().optional(),
  }),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export const replayDlqEntry = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/dlq/:id/replay',
  tag: 'Admin',
  summary: 'Replay DLQ job',
  description: 'Re-enqueues dead-letter job into its origin queue with fresh suffix --r{n}.',
  params: DlqIdParamSchema,
  body: z
    .object({
      resetAttempts: z.boolean().optional().describe('Reset retry attempts to 0'),
      force: z.boolean().optional().describe('Force replay even if already processed'),
    })
    .nullish(),
  status: 202,
  result: z.object({
    status: z.literal('REPLAYED'),
    dlqEntryId: z.string(),
    replayJobId: z.string(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.DLQ_ENTRY_NOT_FOUND],
  },
});

export const discardDlqEntry = defineEndpoint({
  method: 'DELETE',
  path: '/v1/admin/dlq/:id',
  tag: 'Admin',
  summary: 'Discard DLQ job',
  description: 'Marks a dead-letter queue job as DISCARDED.',
  params: DlqIdParamSchema,
  status: 204,
  result: z.null().describe('DLQ entry discarded'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.DLQ_ENTRY_NOT_FOUND],
  },
});

export type DlqEntry = z.infer<typeof DlqEntrySchema>;
export type ListDlqQuery = z.input<typeof ListDlqQuerySchema>;
