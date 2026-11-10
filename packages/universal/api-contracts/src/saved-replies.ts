import { SAVED_REPLY_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const TAG = 'Comment moderation';

const IdParamSchema = z.object({ id: z.uuid({ error: 'Invalid saved reply ID format' }) });

const TitleSchema = z.string().trim().min(1).max(SAVED_REPLY_LIMITS.titleLength);
const BodySchema = z.string().trim().min(1).max(SAVED_REPLY_LIMITS.bodyLength);

const SavedReplySchema = z.object({
  id: z.uuid(),
  title: TitleSchema,
  body: BodySchema,
  position: z.number().int().min(0),
});

export type SavedReplyView = z.infer<typeof SavedReplySchema>;

const SavedReplyListSchema = z.object({ items: z.array(SavedReplySchema) });

export const CreateSavedReplyBodySchema = z.object({ title: TitleSchema, body: BodySchema });

export const UpdateSavedReplyBodySchema = z
  .object({
    title: TitleSchema.optional(),
    body: BodySchema.optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    error: 'Send at least one field to change',
  });

const ERRORS = { 401: [ErrorCodes.UNAUTHORIZED], 403: [ErrorCodes.FORBIDDEN] } as const;

export const listSavedReplies = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/saved-replies',
  channelScoped: true,
  tag: TAG,
  summary: 'List the saved replies of the channel',
  description:
    'Canned replies for the inbox, by position. Owner, managers and moderators read them.',
  status: 200,
  result: SavedReplyListSchema,
  errors: ERRORS,
});

export const createSavedReply = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/saved-replies',
  channelScoped: true,
  tag: TAG,
  summary: 'Save a reply',
  description: `Appends a reply after the last one; a channel keeps at most ${SAVED_REPLY_LIMITS.perChannel}. Owner and managers.`,
  body: CreateSavedReplyBodySchema,
  status: 201,
  result: SavedReplySchema,
  errors: {
    ...ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    409: [ErrorCodes.SAVED_REPLY_LIMIT],
  },
});

export const updateSavedReply = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/channel/saved-replies/:id',
  channelScoped: true,
  tag: TAG,
  summary: 'Edit or move a saved reply',
  description: 'Changes the title, the body or the position of one reply. Owner and managers.',
  params: IdParamSchema,
  body: UpdateSavedReplyBodySchema,
  status: 200,
  result: SavedReplySchema,
  errors: {
    ...ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.SAVED_REPLY_NOT_FOUND],
  },
});

export const deleteSavedReply = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/saved-replies/:id',
  channelScoped: true,
  tag: TAG,
  summary: 'Delete a saved reply',
  description: 'Owner and managers.',
  params: IdParamSchema,
  status: 204,
  result: z.null().describe('The reply is deleted'),
  errors: {
    ...ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.SAVED_REPLY_NOT_FOUND],
  },
});
