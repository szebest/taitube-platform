import { COMMENT_MODERATION_REASONS, DISCLOSURES, MODERATION_STATES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { createComment, listVideoComments } from './comments';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const TAG = 'Threads';

const ThreadIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid thread ID format' }),
});

const ThreadAuthorSchema = z.object({
  channelId: z.uuid(),
  handle: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const ThreadSchema = z.object({
  id: z.uuid(),
  videoId: z.uuid(),
  anchorMs: z.number().int().nonnegative().describe('The moment of the video the thread is about'),
  title: z.string(),
  body: z.string(),
  isPinned: z.boolean(),
  replyCount: z.number().int().nonnegative().describe('Replies a reader can see'),
  status: z
    .enum(MODERATION_STATES)
    .describe('published unless the reader is the author of a held thread or a moderator'),
  author: ThreadAuthorSchema,
  createdAt: z.iso.datetime(),
});

const ThreadMarkerSchema = z.object({
  anchorMs: z.number().int().nonnegative(),
  threadId: z.uuid().describe('The thread a click opens'),
  threadIds: z.array(z.uuid()),
  count: z.number().int().positive().describe('How many threads the marker stands for'),
});

const ThreadListSchema = z.object({
  items: z.array(ThreadSchema),
  markers: z.array(ThreadMarkerSchema),
});

const ThreadBodySchema = z.object({
  anchorMs: z.number().int().nonnegative().describe('Inside the video, in milliseconds'),
  title: z.string().describe('1-100 characters after trimming'),
  body: z.string().default('').describe('Up to 1000 characters; plain text'),
});

const READ_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.THREAD_NOT_FOUND],
} as const;

export const listVideoThreads = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/threads',
  scope: 'comments:read',
  tag: TAG,
  summary: 'List the threads of a video',
  description:
    'The threads a reader may see, pinned first and then by the moment they are about, with the markers the seek bar draws: a thread earns one with 2 replies from 2 viewers or a pin, markers within 1 percent of the duration merge, and at most 20 are drawn. A thread held for review is listed to its author only. Anonymous access permitted.',
  anonymous: true,
  params: VideoIdParamSchema,
  status: 200,
  result: ThreadListSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const createVideoThread = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/threads',
  channelScoped: true,
  tag: TAG,
  summary: 'Start a thread at a moment of a video',
  description:
    'Starts a discussion about one moment as the acting channel. It goes through the comment rules of the video channel, so a thread can be held, refused by a blocked word, slow mode, a ban or comments being off. At most 5 open threads per viewer per video.',
  params: VideoIdParamSchema,
  body: ThreadBodySchema,
  status: 201,
  result: ThreadSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [
      ErrorCodes.FORBIDDEN,
      ErrorCodes.COMMENTS_BANNED,
      ErrorCodes.COMMENTS_DISABLED,
      ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
      ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
    ],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.THREAD_ANCHOR_INVALID],
    429: [ErrorCodes.THREAD_LIMIT, ErrorCodes.COMMENTS_SLOW_MODE],
  },
});

export const getThread = defineEndpoint({
  method: 'GET',
  path: '/v1/threads/:id',
  scope: 'comments:read',
  tag: TAG,
  summary: 'Read a thread',
  description: 'One thread. Anonymous access permitted for a thread of a public video.',
  anonymous: true,
  params: ThreadIdParamSchema,
  status: 200,
  result: ThreadSchema,
  errors: READ_ERRORS,
});

export const listThreadComments = defineEndpoint({
  method: 'GET',
  path: '/v1/threads/:id/comments',
  scope: 'comments:read',
  tag: 'Comments',
  summary: 'List the replies of a thread',
  description:
    'Root comments under a thread with their author channel and reply count, the pinned comment first. Keyset-paginated under sort=top or sort=newest.',
  anonymous: true,
  params: ThreadIdParamSchema,
  query: listVideoComments.query,
  status: 200,
  result: listVideoComments.result,
  errors: { ...listVideoComments.errors, 404: [ErrorCodes.THREAD_NOT_FOUND] },
});

export const createThreadComment = defineEndpoint({
  method: 'POST',
  path: '/v1/threads/:id/comments',
  channelScoped: true,
  tag: 'Comments',
  summary: 'Reply in a thread',
  description:
    'Adds a root comment, or a reply when parentId is given. The channel comment rules of the video apply as they do under the video.',
  params: ThreadIdParamSchema,
  body: createComment.body,
  status: 201,
  result: createComment.result,
  errors: {
    ...createComment.errors,
    404: [ErrorCodes.THREAD_NOT_FOUND, ErrorCodes.COMMENT_NOT_FOUND],
  },
});

const PIN_ERRORS = {
  ...READ_ERRORS,
  409: [ErrorCodes.THREAD_PIN_LIMIT],
} as const;

export const pinThread = defineEndpoint({
  method: 'POST',
  path: '/v1/threads/:id/pin',
  tag: TAG,
  summary: 'Pin a thread',
  description:
    'The video owner, a manager or an editor pins a thread, which then draws a marker whatever its replies. Up to 3 a video, checked in the transaction that pins. Pinning a pinned thread changes nothing.',
  params: ThreadIdParamSchema,
  status: 200,
  result: ThreadSchema,
  errors: PIN_ERRORS,
});

export const unpinThread = defineEndpoint({
  method: 'DELETE',
  path: '/v1/threads/:id/pin',
  tag: TAG,
  summary: 'Unpin a thread',
  description: 'Idempotent: unpinning a thread that is not pinned changes nothing.',
  params: ThreadIdParamSchema,
  status: 200,
  result: ThreadSchema,
  errors: READ_ERRORS,
});

export const removeThread = defineEndpoint({
  method: 'POST',
  path: '/v1/threads/:id/remove',
  scope: 'comments:moderate',
  tag: TAG,
  summary: 'Remove a thread',
  description:
    'The thread author, or whoever moderates the video channel, removes the thread and its replies with it. A moderator chooses a silent or a visible removal; a visible one needs a reason and tells the author. Recorded in the channel audit log.',
  params: ThreadIdParamSchema,
  body: z.object({
    disclosure: z.enum(DISCLOSURES).optional(),
    reason: z.enum(COMMENT_MODERATION_REASONS).optional().describe('Required when visible'),
    note: z.string().max(200).optional(),
  }),
  status: 204,
  result: z.null().describe('Thread removed'),
  errors: { ...READ_ERRORS, 409: [ErrorCodes.MODERATION_NOT_APPLICABLE] },
});

export type ThreadView = z.infer<typeof ThreadSchema>;
export type ThreadListView = z.infer<typeof ThreadListSchema>;
export type ThreadBody = z.infer<typeof ThreadBodySchema>;
export type RemoveThreadBody = z.infer<typeof removeThread.body>;
