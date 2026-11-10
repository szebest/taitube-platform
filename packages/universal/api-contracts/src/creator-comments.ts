import { CREATOR_INBOX_FILTERS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { RestrictionActionSchema } from './channel-restrictions';
import { CommentActionSchema } from './comment-moderation';
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
    authorId: z.uuid().optional().describe('Only the comments this user wrote'),
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

const BulkActionSchema = z
  .union([CommentActionSchema, RestrictionActionSchema, z.object({ action: z.literal('lift') })])
  .describe(
    'Any moderation action; a user action applies to the author of each comment, once per author'
  );

export type BulkActionBody = z.infer<typeof BulkActionSchema>;

const BulkResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.uuid(),
      ok: z.boolean(),
      code: z.enum(ErrorCodes).optional().describe('Why this comment was refused'),
    })
  ),
});

export type BulkResultView = z.infer<typeof BulkResultSchema>;

export const bulkModerateComments = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/comments/bulk',
  channelScoped: true,
  tag: 'Creator Studio',
  summary: 'Moderate up to 100 comments at once',
  description:
    'Applies one action to each comment. Every id is decided by its own rule and the response lists { id, ok, code? } in the order sent, so one refusal never fails the batch. A user action applies once per author, whatever the number of their comments. Each applied action writes its own audit row.',
  body: z.object({
    ids: z.array(z.uuid()).min(1).max(100),
    action: BulkActionSchema,
  }),
  status: 200,
  result: BulkResultSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});
