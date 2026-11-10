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
  channelScoped: true,
  tag: 'Creator Studio',
  summary: 'The creator comment inbox',
  description:
    'Comments on the caller videos that the caller did not write, newest first, keyset-paginated. unanswered keeps those without a later reply from the caller in their thread; reported keeps those with an open report; held and hidden keep those in that moderation state; questions keeps those with a question mark or a leading question word; restricted keeps those whose author has a shadow ban or a ban on the channel that has not ended. Held and hidden comments are listed here with their moderation state, for the people who moderate.',
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
