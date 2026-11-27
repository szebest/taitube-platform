import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema, ChannelHandleParamSchema } from './channels';
import { createComment, listVideoComments } from './comments';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const TAG = 'Posts';

const PostIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid post ID format' }),
});

const PostImageInputSchema = z.object({
  uploadId: z.uuid().describe('A ready post-image upload of the posting channel'),
  alt: z.string().describe('Alt text, 1-200 characters after trimming'),
});

const PostPayloadSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('text'),
      text: z.string().describe('1-2000 characters of plain text'),
    }),
    z.object({
      kind: z.literal('images'),
      images: z.array(PostImageInputSchema).describe('1 to 4 images, in display order'),
      caption: z.string().nullable().describe('Up to 2000 characters'),
    }),
    z.object({
      kind: z.literal('video_share'),
      videoId: z.uuid().describe('A public, ready video'),
      comment: z.string().nullable().describe('Up to 500 characters'),
      startMs: z
        .number()
        .nullable()
        .describe('Where the card opens the video, in whole milliseconds'),
    }),
    z.object({
      kind: z.literal('playlist_share'),
      playlistId: z.uuid().describe('A public playlist'),
      comment: z.string().nullable().describe('Up to 500 characters'),
    }),
  ])
  .meta({ id: 'PostPayload', description: 'What the post says, by kind' });

const PostImageViewSchema = z.object({
  uploadId: z.uuid(),
  alt: z.string(),
  urls: z.object({ w640: z.string(), w1280: z.string() }),
});

const PostShareCardSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('video'),
      id: z.uuid(),
      title: z.string(),
      thumbnailUrl: z.string().nullable(),
      durationSeconds: z.number().int().nonnegative().nullable(),
    }),
    z.object({
      type: z.literal('playlist'),
      id: z.uuid(),
      title: z.string(),
      itemCount: z.number().int().nonnegative(),
    }),
    z.object({ type: z.literal('unavailable') }),
  ])
  .meta({
    id: 'PostShareCard',
    description:
      'What a shared video or playlist shows, or `unavailable` once it is gone or not public, and then nothing of it',
  });

const PostBodySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string() }),
    z.object({
      kind: z.literal('images'),
      images: z
        .array(PostImageViewSchema)
        .describe('An image whose upload is not ready is left out'),
      caption: z.string().nullable(),
    }),
    z.object({
      kind: z.literal('video_share'),
      comment: z.string().nullable(),
      startMs: z.number().int().nonnegative().nullable(),
      card: PostShareCardSchema,
    }),
    z.object({
      kind: z.literal('playlist_share'),
      comment: z.string().nullable(),
      card: PostShareCardSchema,
    }),
  ])
  .meta({ id: 'PostBody', description: 'The post ready to render, by kind' });

const PostSchema = z
  .object({
    id: z.uuid(),
    channel: ChannelCardSchema.describe(
      "The channel that published it; a team member's post shows the channel, never the member"
    ),
    kind: z.enum(['text', 'images', 'video_share', 'playlist_share']),
    body: PostBodySchema,
    commentsEnabled: z.boolean(),
    likeCount: z.number().int().nonnegative(),
    commentsCount: z.number().int().nonnegative(),
    likedByViewer: z.boolean().describe('False for an anonymous reader'),
    isEdited: z.boolean(),
    publishedAt: z.string().describe('ISO 8601 timestamp'),
    version: z.number().int().positive().describe('The version an edit is made against'),
  })
  .meta({ id: 'Post', description: 'A published channel post' });

const PostPageSchema = z.object({
  items: z.array(PostSchema),
  nextCursor: z.string().nullable(),
});

const PostLikeSchema = z.object({
  postId: z.uuid(),
  liked: z.boolean(),
  likeCount: z.number().int().nonnegative(),
});

const PostWriteBodySchema = z.object({
  payload: PostPayloadSchema,
  commentsEnabled: z.boolean().default(true).describe('Whether viewers may reply to the post'),
});

const WHO =
  'Owner, manager and editor of the channel the request acts on; a moderator and an analyst are refused.';

const WRITE_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.POST_SHARE_NOT_PUBLIC],
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
  summary: 'Publish a post',
  description: `Publishes a text, images, video or playlist post as the acting channel and tells its subscribers. A shared video or playlist must be public. At most 20 posts a day per channel. ${WHO}`,
  body: PostWriteBodySchema,
  status: 201,
  result: PostSchema,
  errors: { ...WRITE_ERRORS, 429: [ErrorCodes.POST_DAILY_LIMIT] },
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
    version: z.number().int().positive().describe('The version the edit was made against'),
  }),
  status: 200,
  result: PostSchema,
  errors: { ...WRITE_ERRORS, 404: [ErrorCodes.POST_NOT_FOUND], 409: [ErrorCodes.VERSION_CONFLICT] },
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

export type PostView = z.infer<typeof PostSchema>;
export type PostPageView = z.infer<typeof PostPageSchema>;
export type PostLikeView = z.infer<typeof PostLikeSchema>;
export type PostWriteBody = z.infer<typeof PostWriteBodySchema>;
