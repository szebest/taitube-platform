import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { ManagedPostSchema, PostIdParamSchema, PostSchema } from './post-schemas';

const TAG = 'Posts';

const WHO =
  'Owner, manager and editor of the channel the request acts on; a moderator and an analyst are refused.';

const ManagedPostPageSchema = z.object({
  items: z.array(ManagedPostSchema),
  nextCursor: z.string().nullable(),
});

const PostStatsSchema = z
  .object({
    opens: z.number().int().nonnegative().describe('Distinct viewers per day, summed'),
    shareClicks: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    replies: z.number().int().nonnegative(),
    votesByOption: z
      .array(z.number().int().nonnegative())
      .describe('Empty for a post without options'),
    quizCorrectShare: z.number().min(0).max(1).nullable().describe('Null until a quiz is answered'),
  })
  .meta({ id: 'PostStats', description: 'What the team sees of one post; never on a public post' });

const PinErrors = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  404: [ErrorCodes.POST_NOT_FOUND],
} as const;

export const listManagedPosts = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/posts',
  channelScoped: true,
  tag: TAG,
  summary: 'List the posts of the acting channel',
  description: `Drafts, scheduled and published posts, newest created first, keyset-paginated. ${WHO}`,
  query: KeysetQuerySchema.extend({
    status: z.enum(['draft', 'scheduled', 'published']).optional(),
  }),
  status: 200,
  result: ManagedPostPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const pinPost = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/posts/:id/pin',
  scope: 'posts:write',
  channelScoped: true,
  tag: TAG,
  summary: 'Pin a post',
  description: `Pins a published post of the acting channel above the rest, newest pin first; the fourth pin is refused. ${WHO}`,
  params: PostIdParamSchema,
  status: 200,
  result: ManagedPostSchema,
  errors: { ...PinErrors, 409: [ErrorCodes.POST_PIN_LIMIT] },
});

export const unpinPost = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/posts/:id/pin',
  scope: 'posts:write',
  channelScoped: true,
  tag: TAG,
  summary: 'Unpin a post',
  description: `Idempotent: unpinning a post that is not pinned changes nothing. ${WHO}`,
  params: PostIdParamSchema,
  status: 200,
  result: ManagedPostSchema,
  errors: PinErrors,
});

export const getPostStats = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/posts/:id/stats',
  channelScoped: true,
  tag: TAG,
  summary: 'Read the stats of a post',
  description:
    'Opens, likes, replies, votes by option, share clicks and the share of quiz answers that were right. Owner, manager and the analytics role; nothing of it is on a public post.',
  params: PostIdParamSchema,
  status: 200,
  result: PostStatsSchema,
  errors: PinErrors,
});

export const votePost = defineEndpoint({
  method: 'PUT',
  path: '/v1/posts/:id/vote',
  tag: TAG,
  summary: 'Vote on a poll or answer a quiz',
  description:
    'One final vote per viewer: a second one answers 409. The post comes back with its results (and a quiz with its answer and explanation). A banned viewer is refused with COMMENTS_BANNED, a guest with FORBIDDEN.',
  params: PostIdParamSchema,
  body: z.object({ optionIndex: z.number().int().describe('Index of the chosen option') }),
  status: 200,
  result: PostSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN, ErrorCodes.COMMENTS_BANNED],
    404: [ErrorCodes.POST_NOT_FOUND],
    409: [ErrorCodes.POST_ALREADY_VOTED, ErrorCodes.POST_POLL_CLOSED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

const BEACON_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  404: [ErrorCodes.POST_NOT_FOUND],
} as const;

export const recordPostOpen = defineEndpoint({
  method: 'POST',
  path: '/v1/posts/:id/open',
  tag: TAG,
  summary: 'Count a post open',
  description:
    'Counted once per viewer and day. Anonymous access permitted; the viewer is a signed-in account or the address.',
  anonymous: true,
  params: PostIdParamSchema,
  status: 204,
  result: z.null().describe('Counted'),
  errors: BEACON_ERRORS,
});

export const recordPostShareClick = defineEndpoint({
  method: 'POST',
  path: '/v1/posts/:id/share-click',
  tag: TAG,
  summary: 'Count a click on the share card of a post',
  description: 'The beacon of the post card. Anonymous access permitted.',
  anonymous: true,
  params: PostIdParamSchema,
  status: 204,
  result: z.null().describe('Counted'),
  errors: BEACON_ERRORS,
});

export type ManagedPostPageView = z.infer<typeof ManagedPostPageSchema>;
export type PostStatsView = z.infer<typeof PostStatsSchema>;
