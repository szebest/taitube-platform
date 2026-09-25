import { COMMENT_SORTS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { PAGE_SIZE_MAX } from '@vp/pagination';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { CursorSchema, KeysetQuerySchema, PageLimitSchema } from './pagination';
import { VideoIdParamSchema } from './video-resource';

const CommentIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid comment ID format' }),
});

const CommentAuthorSchema = z.object({
  userId: z.string().uuid(),
  channelId: z.string().uuid().nullable().describe('Null for an author without a channel'),
  handle: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isCreator: z.boolean().describe('The author owns the video, shown as a creator badge'),
});

const CommentSchema = z.object({
  id: z.string().uuid(),
  videoId: z.string().uuid(),
  parentId: z.string().uuid().nullable().describe('The root comment of a reply, null for a root'),
  content: z.string(),
  isPinned: z.boolean(),
  isEdited: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  author: CommentAuthorSchema,
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
});

const CommentContentSchema = z
  .string()
  .describe('Plain text, 1-2000 characters after trimming; markup is kept as text');

const CommentPageSchema = z.object({
  items: z.array(CommentSchema),
  nextCursor: z.string().nullable(),
});

const LIST_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

const ListCommentsQuerySchema = z.object({
  sort: z.enum(COMMENT_SORTS).default('top').describe('top: pinned, likes, recency; newest'),
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Legacy 1-based page number; the keyset cursor is preferred'),
  size: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .optional()
    .describe('Legacy page size, read in place of limit when given'),
});

export const listVideoComments = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/comments',
  tag: 'Comments',
  summary: 'List top-level comments of a video',
  description:
    'Root comments with their author channel and reply count, the pinned comment first. Keyset-paginated under sort=top or sort=newest, with legacy page/size. The first top page is served from a 60 s Redis cache.',
  anonymous: true,
  params: VideoIdParamSchema,
  query: ListCommentsQuerySchema,
  status: 200,
  result: CommentPageSchema.extend({
    total: z.number().int().nonnegative().describe('Every live comment on the video, replies too'),
  }),
  errors: { ...LIST_ERRORS, 404: [ErrorCodes.VIDEO_NOT_FOUND] },
});

export const listCommentReplies = defineEndpoint({
  method: 'GET',
  path: '/v1/comments/:id/replies',
  tag: 'Comments',
  summary: 'List replies to a comment',
  description: 'Replies under a root comment, oldest first, keyset-paginated.',
  anonymous: true,
  params: CommentIdParamSchema,
  query: KeysetQuerySchema,
  status: 200,
  result: CommentPageSchema,
  errors: { ...LIST_ERRORS, 404: [ErrorCodes.COMMENT_NOT_FOUND] },
});

export const createComment = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/comments',
  tag: 'Comments',
  summary: 'Comment on a video or reply to a comment',
  description:
    'Adds a root comment, or a reply when parentId is given. A reply to a reply joins the root thread. Increments the video comment count and purges the hot comments cache.',
  params: VideoIdParamSchema,
  body: z.object({
    content: CommentContentSchema,
    parentId: z.string().uuid().optional().describe('The comment being answered'),
  }),
  status: 201,
  result: CommentSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.COMMENT_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const updateComment = defineEndpoint({
  method: 'PATCH',
  path: '/v1/comments/:id',
  tag: 'Comments',
  summary: 'Edit a comment',
  description: 'The author rewrites their comment, which is then marked edited.',
  params: CommentIdParamSchema,
  body: z.object({ content: CommentContentSchema }),
  status: 200,
  result: CommentSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.COMMENT_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const deleteComment = defineEndpoint({
  method: 'DELETE',
  path: '/v1/comments/:id',
  tag: 'Comments',
  summary: 'Delete a comment',
  description:
    'The author, the video owner, a moderator or an admin removes a comment, and its replies with it. Decrements the video comment count and purges the hot comments cache.',
  params: CommentIdParamSchema,
  status: 204,
  result: z.null().describe('Comment deleted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.COMMENT_NOT_FOUND],
  },
});

const PIN_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.COMMENT_NOT_FOUND],
  409: [ErrorCodes.COMMENT_NOT_PINNABLE],
} as const;

export const pinComment = defineEndpoint({
  method: 'POST',
  path: '/v1/comments/:id/pin',
  tag: 'Comments',
  summary: 'Pin a comment',
  description:
    'The video owner pins a top-level comment to the top of the list, unpinning whichever comment held the slot.',
  params: CommentIdParamSchema,
  status: 200,
  result: CommentSchema,
  errors: PIN_ERRORS,
});

export const unpinComment = defineEndpoint({
  method: 'DELETE',
  path: '/v1/comments/:id/pin',
  tag: 'Comments',
  summary: 'Unpin a comment',
  description: 'The video owner returns a pinned comment to its ranked place.',
  params: CommentIdParamSchema,
  status: 200,
  result: CommentSchema,
  errors: PIN_ERRORS,
});

export type CommentView = z.infer<typeof CommentSchema>;
export type ListCommentsQuery = z.input<typeof ListCommentsQuerySchema>;
