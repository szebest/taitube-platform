import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema, VideoSummarySchema } from './video-resource';

const REASON_KINDS = [
  'continue',
  'subscription',
  'co-watched',
  'shared-tags',
  'same-channel',
  'same-category',
  'category',
  'trending',
  'searched',
  'rising',
] as const;

const SHELF_KINDS = [
  'continue',
  'subscriptions',
  'because-searched',
  'because-watched',
  'category',
  'rising',
  'trending',
] as const;

const SUBJECT_KINDS = ['video', 'channel', 'category', 'query'] as const;

const ReasonSchema = z.object({
  kind: z.enum(REASON_KINDS).describe('Why the video was picked; the client turns it into copy'),
  subjectId: z.uuid().optional().describe('The video, channel, category or search the reason points at'),
});

const ReasonedVideoSchema = VideoSummarySchema.extend({ reason: ReasonSchema });

const ShelfSubjectSchema = z.object({
  kind: z.enum(SUBJECT_KINDS),
  id: z.uuid(),
  name: z.string().describe('Video title, channel name, category name or the search text'),
});

const ShelfSchema = z.object({
  kind: z.enum(SHELF_KINDS),
  subject: ShelfSubjectSchema.optional().describe(
    'What a because-searched, because-watched or category shelf is about'
  ),
  items: z.array(ReasonedVideoSchema),
});

export const getHome = defineEndpoint({
  method: 'GET',
  path: '/v1/home',
  tag: 'Home',
  summary: 'Home shelves',
  description:
    'Ordered shelves, each item with the reason it was picked. A signed-in caller gets continue, subscriptions and because-watched shelves from their history and subscriptions; a signed-in caller who searched in the last 48 hours also gets a because-searched shelf, the results of their latest search minus what they watched; everyone gets category, rising (videos of small channels that viewers finish) and trending shelves. A signed-in result is cached per caller for five minutes and dropped on a new watch, a subscription or recommendation feedback. What the caller marked through PUT /v1/me/recommendation-feedback leaves every shelf except continue and subscriptions. Anonymous access permitted.',
  anonymous: true,
  status: 200,
  result: z.object({ shelves: z.array(ShelfSchema) }),
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});

export const getRelatedVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/related',
  tag: 'Videos',
  summary: 'Related videos',
  description:
    'Up to 20 public ready videos ranked by co-watch, shared tags, same channel and same category, each with its reason. Never the video itself, the caller own uploads or what the caller marked through PUT /v1/me/recommendation-feedback. Anonymous access permitted.',
  anonymous: true,
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(ReasonedVideoSchema) }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export type HomeResponse = z.infer<typeof getHome.result>;
export type HomeShelf = HomeResponse['shelves'][number];
export type ReasonedVideo = z.infer<typeof ReasonedVideoSchema>;
