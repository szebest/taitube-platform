import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import {
  ContentRefSchema,
  EndScreenItemsSchema,
  EndScreenLayoutSchema,
} from './content-link-schemas';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const StartsAtMsSchema = z.number().int().min(0);

const EndScreenSchema = z.object({
  videoId: z.uuid(),
  layout: EndScreenLayoutSchema,
  startsAtMs: StartsAtMsSchema.describe('5 to 20 seconds before the end'),
  items: EndScreenItemsSchema.describe('Up to four, in display order'),
  showSubscribe: z.boolean(),
  version: z.number().int().positive(),
});

const ReplaceEndScreenBodySchema = z.object({
  layout: EndScreenLayoutSchema,
  startsAtMs: StartsAtMsSchema,
  items: EndScreenItemsSchema,
  showSubscribe: z.boolean(),
  version: z
    .number()
    .int()
    .nonnegative()
    .describe('The version read; 0 when the video has no end screen yet'),
});

const EndScreenItemViewSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('content'),
    ref: ContentRefSchema,
    title: z.string(),
    mediaVideoId: z.uuid().nullable(),
  }),
  z.object({ type: z.literal('channel_tab'), channelId: z.uuid(), tabId: z.string() }),
  z.object({
    type: z.literal('next_episode'),
    ref: ContentRefSchema,
    title: z.string(),
    mediaVideoId: z.uuid().nullable(),
  }),
  z.object({ type: z.literal('subscribe') }),
]);

const EndScreenReadSchema = z.object({
  endScreen: z
    .object({
      layout: EndScreenLayoutSchema,
      startsAtMs: StartsAtMsSchema,
      showSubscribe: z.boolean(),
      items: z.array(EndScreenItemViewSchema).max(4),
    })
    .nullable(),
  fallback: z
    .boolean()
    .describe(
      "True when none is set or nothing in it can be shown: the client uses 100's related videos"
    ),
});

export const getVideoEndScreen = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/end-screen',
  tag: 'Videos',
  summary: "Read a video's end screen as the viewer sees it",
  description:
    "The creator's picks that the viewer can see, with the next episode of the series filled in for this viewer (absent when there is none). A pick the viewer cannot see is left out. Anonymous access permitted.",
  anonymous: true,
  params: VideoIdParamSchema,
  status: 200,
  result: EndScreenReadSchema,
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 404: [ErrorCodes.VIDEO_NOT_FOUND] },
});

export const getCreatorVideoEndScreen = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/end-screen',
  channelScoped: true,
  tag: 'Videos',
  summary: "Read a video's end screen for editing",
  description: 'The stored end screen with its version, or null when none is set.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ endScreen: EndScreenSchema.nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN, ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const replaceVideoEndScreen = defineEndpoint({
  method: 'PUT',
  path: '/v1/videos/:id/end-screen',
  channelScoped: true,
  tag: 'Videos',
  summary: "Replace a video's end screen",
  description:
    'Replaces the whole end screen when `version` is the stored one. Up to four items, a next_episode and a subscribe item at most once each, starting 5 to 20 seconds before the end of the video. A content item must be one the creator may link. 409 when another save got there first.',
  params: VideoIdParamSchema,
  body: ReplaceEndScreenBodySchema,
  status: 200,
  result: EndScreenSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN, ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.END_SCREEN_INVALID],
  },
});

export type EndScreenRead = z.infer<typeof EndScreenReadSchema>;
export type EndScreenItemView = z.infer<typeof EndScreenItemViewSchema>;
export type EndScreenResource = z.infer<typeof EndScreenSchema>;
export type ReplaceEndScreenBody = z.infer<typeof ReplaceEndScreenBodySchema>;
