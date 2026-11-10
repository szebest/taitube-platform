import { COMMENT_MODERATION_REASONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const RemovalSchema = z.object({
  id: z.uuid().describe('The id the removed comment had'),
  videoId: z.uuid(),
  excerpt: z.string().describe('The first 200 characters of the removed comment'),
  reason: z.enum(COMMENT_MODERATION_REASONS),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type CommentRemovalView = z.infer<typeof RemovalSchema>;

export const listMyCommentRemovals = defineEndpoint({
  method: 'GET',
  path: '/v1/me/comment-removals',
  tag: 'Comment moderation',
  summary: 'The own comments a moderator removed visibly',
  description:
    'Removals of the caller comments from the last 30 days that were done visibly, with the reason and the note, newest first. A silent removal is never listed.',
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(RemovalSchema), nextCursor: z.string().nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});
