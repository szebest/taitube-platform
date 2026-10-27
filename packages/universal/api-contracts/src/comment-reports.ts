import { COMMENT_REPORT_REASONS, COMMENT_REPORT_RESOLUTIONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { CommentIdParamSchema } from './comments';
import { defineEndpoint } from './endpoint';
import { CursorSchema, OptionalPageLimitSchema } from './pagination';

const CommentReportSchema = z.object({
  id: z.uuid(),
  commentId: z.uuid(),
  reason: z.enum(COMMENT_REPORT_REASONS),
  note: z.string().nullable(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  resolvedAt: z.string().nullable().describe('ISO 8601 resolution timestamp, null while open'),
  resolution: z.enum(COMMENT_REPORT_RESOLUTIONS).nullable(),
});

const CommentReportQueueItemSchema = CommentReportSchema.extend({
  reporterId: z.uuid(),
  comment: z.object({
    id: z.uuid(),
    videoId: z.uuid(),
    authorId: z.uuid(),
    content: z.string(),
    removed: z.boolean().describe('The comment was removed, by this report or otherwise'),
  }),
});

const ReportIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid report ID format' }),
});

export const reportComment = defineEndpoint({
  method: 'POST',
  path: '/v1/comments/:id/reports',
  tag: 'Comments',
  summary: 'Report a comment',
  description:
    'Any signed-in viewer reports a comment they can see, once. A second report by the same viewer is refused.',
  params: CommentIdParamSchema,
  body: z.object({
    reason: z.enum(COMMENT_REPORT_REASONS),
    note: z
      .string()
      .optional()
      .describe('Plain text, at most 500 characters after trimming; blank is no note'),
  }),
  status: 201,
  result: CommentReportSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.COMMENT_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.COMMENT_ALREADY_REPORTED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const listCommentReports = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/reports',
  tag: 'Admin',
  summary: 'List comment reports',
  description:
    'The report queue, open reports first and each group newest first, keyset-paginated.',
  query: z.object({
    cursor: CursorSchema.optional(),
    limit: OptionalPageLimitSchema,
  }),
  status: 200,
  result: z.object({
    items: z.array(CommentReportQueueItemSchema),
    nextCursor: z.string().nullable(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export const resolveCommentReport = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/reports/:id/resolve',
  tag: 'Admin',
  summary: 'Resolve a comment report',
  description:
    'An admin resolves a report as removed, which deletes the comment and its replies and closes every open report on it, or as dismissed.',
  params: ReportIdParamSchema,
  body: z.object({ resolution: z.enum(COMMENT_REPORT_RESOLUTIONS) }),
  status: 200,
  result: CommentReportSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.REPORT_NOT_FOUND],
    409: [ErrorCodes.REPORT_ALREADY_RESOLVED],
  },
});

export type CommentReportView = z.infer<typeof CommentReportSchema>;
export type CommentReportQueueItemView = z.infer<typeof CommentReportQueueItemSchema>;
