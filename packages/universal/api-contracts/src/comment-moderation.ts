import { COMMENT_MODERATION_REASONS, DISCLOSURES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { CommentIdParamSchema, CommentSchema } from './comments';
import { defineEndpoint } from './endpoint';

const TAG = 'Comment moderation';

const ModeratedFields = {
  disclosure: z
    .enum(DISCLOSURES)
    .optional()
    .describe("Overrides the channel's default for this action: what the comment's author is told"),
  reason: z
    .enum(COMMENT_MODERATION_REASONS)
    .optional()
    .describe('Required when the action is visible'),
  note: z.string().max(200).optional(),
};

export const CommentActionSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('hold'), ...ModeratedFields }),
    z.object({ action: z.literal('approve') }),
    z.object({ action: z.literal('hide'), ...ModeratedFields }),
    z.object({ action: z.literal('unhide') }),
    z.object({ action: z.literal('remove'), ...ModeratedFields }),
  ])
  .describe('One action on a comment; approve and unhide restore, so they carry no disclosure');

export type CommentActionBody = z.infer<typeof CommentActionSchema>;

const ModerationResultSchema = z.object({
  state: z.enum(['published', 'held', 'hidden', 'removed']),
  comment: CommentSchema.nullable().describe('Null once the comment is removed'),
});

export const moderateComment = defineEndpoint({
  method: 'POST',
  path: '/v1/comments/:id/moderate',
  tag: TAG,
  summary: 'Hold, approve, hide, unhide or remove a comment',
  description:
    'One endpoint for every comment action, decided by the caller permission on that action: the video owner, and members whose role moderates comments. A visible hold, hide or remove needs a reason and tells the author; a silent one tells nobody. Records the action in the channel audit log with the disclosure used. Remove deletes the comment and its replies.',
  params: CommentIdParamSchema,
  body: CommentActionSchema,
  status: 200,
  result: ModerationResultSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.COMMENT_NOT_FOUND],
    409: [ErrorCodes.MODERATION_NOT_APPLICABLE],
  },
});

export type ModerationResultView = z.infer<typeof ModerationResultSchema>;
