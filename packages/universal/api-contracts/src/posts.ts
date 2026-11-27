import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelHandleParamSchema } from './channels';
import { createComment, listVideoComments } from './comments';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import {
  ManagedPostSchema,
  PostIdParamSchema,
  PostLikeSchema,
  PostPageSchema,
  PostSchema,
  PostTimingSchema,
  PostWriteBodySchema,
} from './post-schemas';

const TAG = 'Posts';

const WHO =
  'Owner, manager and editor of the channel the request acts on; a moderator and an analyst are refused.';

const WRITE_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  422: [
    ErrorCodes.VALIDATION_FAILED,
    ErrorCodes.POST_SHARE_NOT_PUBLIC,
    ErrorCodes.POST_IMAGE_NOT_READY,
    ErrorCodes.POST_SCHEDULE_INVALID,
  ],
} as const;

export const listChannelPosts = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/posts',
  tag: TAG,
  summary: "List a channel's posts",
  description:
    "Published posts of the channel, by UUID or @handle, pinned first and then newest, each with the viewer's like. Keyset-paginated. Anonymous access permitted.",
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: KeysetQuerySchema,
  status: 200,
  result: PostPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const getPost = defineEndpoint({
  method: 'GET',
  path: '/v1/posts/:id',
  tag: TAG,
  summary: 'Read a post',
  description: 'One published post. Anonymous access permitted.',
  anonymous: true,
  params: PostIdParamSchema,
  status: 200,
  result: PostSchema,
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 404: [ErrorCodes.POST_NOT_FOUND] },
});

export const createPost = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/posts',
  scope: 'posts:write',
  channelScoped: true,
  tag: TAG,
  summary: 'Publish, schedule or draft a post',
  description: `Publishes a text, images, poll, quiz, video or playlist post as the acting channel and tells its subscribers, or keeps it as a draft or schedules it (the timing field). Every image must be a ready post image of the channel. At most 50 drafts and scheduled posts. A shared video or playlist must be public. At most 20 posts a day per channel. ${WHO}`,
  body: PostWriteBodySchema,
  status: 201,
  result: ManagedPostSchema,
  errors: { ...WRITE_ERRORS, 429: [ErrorCodes.POST_DAILY_LIMIT, ErrorCodes.POST_DRAFT_LIMIT] },
});

export const updatePost = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/channel/posts/:id',
  scope: 'posts:write',
  channelScoped: true,
  tag: TAG,
  summary: 'Edit a post',
  description: `Replaces the payload and the replies switch of a post of the acting channel, against the version it was read at; answers 409 VERSION_CONFLICT when the post moved on. The post then shows as edited. ${WHO}`,
  params: PostIdParamSchema,
  body: PostWriteBodySchema.extend({
    commentsEnabled: z.boolean().optional().describe('Left as it is when absent'),
    timing: PostTimingSchema.optional().describe(
      'Moves a draft or scheduled post: publish now, keep as a draft or reschedule; absent keeps its status'
    ),
    version: z.number().int().positive().describe('The version the edit was made against'),
  }),
  status: 200,
  result: ManagedPostSchema,
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.POST_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT, ErrorCodes.POST_POLL_LOCKED],
  },
});

export const deletePost = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/posts/:id',
  scope: 'posts:write',
  channelScoped: true,
  tag: TAG,
  summary: 'Delete a post',
  description: `Deletes a post of the acting channel, its replies and likes with it. ${WHO}`,
  params: PostIdParamSchema,
  status: 204,
  result: z.null().describe('Post deleted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.POST_NOT_FOUND],
  },
});

const LIKE_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.POST_NOT_FOUND],
} as const;

export const likePost = defineEndpoint({
  method: 'PUT',
  path: '/v1/posts/:id/reactions',
  tag: TAG,
  summary: 'Like a post',
  description: 'Idempotent: liking a liked post changes nothing.',
  params: PostIdParamSchema,
  status: 200,
  result: PostLikeSchema,
  errors: LIKE_ERRORS,
});

export const unlikePost = defineEndpoint({
  method: 'DELETE',
  path: '/v1/posts/:id/reactions',
  tag: TAG,
  summary: 'Remove the like from a post',
  description: 'Idempotent: unliking a post that is not liked changes nothing.',
  params: PostIdParamSchema,
  status: 200,
  result: PostLikeSchema,
  errors: LIKE_ERRORS,
});

export const getCommunityFeed = defineEndpoint({
  method: 'GET',
  path: '/v1/feed/community',
  channelScoped: true,
  tag: TAG,
  summary: 'Posts of subscribed channels',
  description:
    'Published posts of the channels the acting channel subscribes to, newest first, keyset-paginated. The videos of those channels are `getSubscriptionFeed`.',
  query: KeysetQuerySchema,
  status: 200,
  result: PostPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const listPostComments = defineEndpoint({
  method: 'GET',
  path: '/v1/posts/:id/comments',
  scope: 'comments:read',
  tag: 'Comments',
  summary: 'List top-level comments of a post',
  description:
    'Root comments under a post with their author channel and reply count, the pinned comment first. Keyset-paginated under sort=top or sort=newest.',
  anonymous: true,
  params: PostIdParamSchema,
  query: listVideoComments.query,
  status: 200,
  result: listVideoComments.result,
  errors: { ...listVideoComments.errors, 404: [ErrorCodes.POST_NOT_FOUND] },
});

export const createPostComment = defineEndpoint({
  method: 'POST',
  path: '/v1/posts/:id/comments',
  channelScoped: true,
  tag: 'Comments',
  summary: 'Comment on a post or reply to a comment',
  description:
    'Adds a root comment, or a reply when parentId is given. A reply to a reply joins the root thread. The channel comment rules apply as they do under a video.',
  params: PostIdParamSchema,
  body: createComment.body,
  status: 201,
  result: createComment.result,
  errors: {
    ...createComment.errors,
    404: [ErrorCodes.POST_NOT_FOUND, ErrorCodes.COMMENT_NOT_FOUND],
  },
});

export type {
  ManagedPostView,
  PostLikeView,
  PostPageView,
  PostView,
  PostWriteBody,
  PostWriteInput,
} from './post-schemas';
