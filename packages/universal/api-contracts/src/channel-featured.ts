import { FEATURED_SOURCES, FEATURED_VIDEOS_MAX } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelHandleParamSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { VideoSummarySchema } from './video-resource';

const ChannelFeaturedSchema = z.object({
  source: z
    .enum(FEATURED_SOURCES)
    .describe(
      'pinned: the creator chose these; popular: the channel pinned none that still qualify'
    ),
  items: z
    .array(VideoSummarySchema)
    .max(FEATURED_VIDEOS_MAX)
    .describe('In display order, public and ready videos only'),
});

const SetChannelFeaturedBodySchema = z.object({
  videoIds: z
    .array(z.uuid({ error: 'Invalid video ID format' }))
    .describe(
      `The videos to pin in display order: at most ${FEATURED_VIDEOS_MAX}, each once, each a public ready video of the caller. An empty list clears the shelf.`
    ),
});

export const getChannelFeatured = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/featured',
  tag: 'Channels',
  summary: "Read a channel's Start here shelf",
  description:
    "The videos the creator pinned that are still public and ready, in the order they chose, with source 'pinned'. A video that turned private, unlisted or was deleted drops out on the next read. When none qualify, the channel's most-viewed public uploads (up to six) with source 'popular'. By channel UUID or @handle. Anonymous access permitted.",
  anonymous: true,
  params: ChannelHandleParamSchema,
  status: 200,
  result: ChannelFeaturedSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const setChannelFeatured = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/featured',
  tag: 'Channels',
  summary: "Replace the caller's Start here shelf",
  description:
    "Replaces the set of pinned videos with the ones given, in that order, in one write. At most six, each once, each a public ready video of the caller: a seventh, a repeat, a private or processing video is refused with 422, another creator's video with 403, an unknown one with 404. Answers the shelf as a visitor now reads it.",
  body: SetChannelFeaturedBodySchema,
  status: 200,
  result: ChannelFeaturedSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type ChannelFeaturedView = z.infer<typeof ChannelFeaturedSchema>;
