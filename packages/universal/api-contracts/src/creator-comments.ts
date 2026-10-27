import { CREATOR_INBOX_FILTERS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { CommentSchema } from './comments';
import { defineEndpoint } from './endpoint';
import { CursorSchema, PageLimitSchema } from './pagination';

const CreatorInboxCommentSchema = CommentSchema.extend({
  video: z.object({ id: z.uuid(), title: z.string() }).describe('The video the comment is on'),
});

export const listCreatorComments = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/comments',
  tag: 'Creator Studio',
  summary: 'The creator comment inbox',
  description:
    'Comments on the caller videos that the caller did not write, newest first, keyset-paginated. unanswered keeps those without a later reply from the caller in their thread; reported keeps those with an open report.',
  query: z.object({
    filter: z.enum(CREATOR_INBOX_FILTERS).default('all'),
    cursor: CursorSchema.optional(),
    limit: PageLimitSchema,
  }),
  status: 200,
  result: z.object({
    items: z.array(CreatorInboxCommentSchema),
    nextCursor: z.string().nullable(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export type CreatorInboxCommentView = z.infer<typeof CreatorInboxCommentSchema>;
