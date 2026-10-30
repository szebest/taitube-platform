import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { VideoListResponseSchema } from './video-resource';

const AuthoredCommentSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  parentId: z.uuid().nullable().describe('The root comment of a reply, null for a root'),
  likeCount: z.number().int().nonnegative(),
  video: z.object({ id: z.uuid(), title: z.string() }),
});

const LIST_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

export const listLikedVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/me/liked-videos',
  tag: 'Viewer activity',
  summary: 'List the videos I liked',
  description:
    'Newest like first, keyset-paginated on (updated_at, id) of the like. A video made private or deleted drops out of the page, and each item carries the caller playhead. A viewer likes are private: no route reads another user.',
  query: KeysetQuerySchema,
  status: 200,
  result: VideoListResponseSchema,
  errors: LIST_ERRORS,
});

export const listMyComments = defineEndpoint({
  method: 'GET',
  path: '/v1/me/comments',
  tag: 'Viewer activity',
  summary: 'List my comments',
  description:
    'The caller comments and replies, newest first, keyset-paginated on (created_at, id), for videos the caller can still read. A removed comment is not listed.',
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(AuthoredCommentSchema), nextCursor: z.string().nullable() }),
  errors: LIST_ERRORS,
});

export type AuthoredCommentView = z.infer<typeof AuthoredCommentSchema>;
