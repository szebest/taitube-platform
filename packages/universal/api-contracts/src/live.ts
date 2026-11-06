import { LIVE_CHAT_SLOW_MODE_MAX_SECONDS, LIVE_STREAM_STATUSES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';

export const LiveStreamIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid live stream ID format' }),
});

export const LiveChatModeSchema = z
  .object({
    slowModeSeconds: z.number().int().min(0).max(LIVE_CHAT_SLOW_MODE_MAX_SECONDS),
    subscribersOnly: z.boolean(),
  })
  .meta({ id: 'LiveChatMode', description: 'Who may chat, and how often' });

const LiveStreamSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(LIVE_STREAM_STATUSES),
    title: z.string(),
    description: z.string(),
    channel: ChannelCardSchema,
    videoId: z.uuid().nullable().describe('The broadcast as a video, once it went live'),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    viewers: z.number().int().nonnegative().describe('Watching now; 0 once it ended'),
    playbackUrl: z
      .string()
      .nullable()
      .describe('The LL-HLS master while live, the recording once it is ready'),
    chat: LiveChatModeSchema,
  })
  .meta({ id: 'LiveStream', description: 'A broadcast as a viewer sees it' });

const ListLiveQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(48).optional() })
  .optional();

export const listLiveStreams = defineEndpoint({
  method: 'GET',
  path: '/v1/live',
  tag: 'Live',
  summary: 'List streams live now',
  description: 'Public broadcasts live now, the latest to start first: the Live now shelf.',
  anonymous: true,
  query: ListLiveQuerySchema,
  status: 200,
  result: z.object({ items: z.array(LiveStreamSchema) }),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED] },
});

export const getLiveStream = defineEndpoint({
  method: 'GET',
  path: '/v1/live/:id',
  tag: 'Live',
  summary: 'Get a live stream',
  description:
    'A broadcast that went live, while live and after; who may see it follows its video. An idle stream is not found.',
  anonymous: true,
  params: LiveStreamIdParamSchema,
  status: 200,
  result: LiveStreamSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
  },
});

const OverlayTokenParamSchema = z.object({ token: z.string().min(1).max(128) });

export const getLiveOverlay = defineEndpoint({
  method: 'GET',
  path: '/v1/live/overlay/:token',
  tag: 'Live',
  summary: 'Get an OBS overlay',
  description:
    "What a browser source in OBS shows: the creator's open stream and the subscriber count for the goal bar. The token is the credential, so it works before the broadcast starts.",
  anonymous: true,
  params: OverlayTokenParamSchema,
  status: 200,
  result: z.object({
    stream: LiveStreamSchema,
    subscriberCount: z.number().int().nonnegative(),
  }),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 404: [ErrorCodes.LIVE_STREAM_NOT_FOUND] },
});

const LiveViewersSchema = z.object({
  liveStreamId: z.uuid(),
  viewers: z.number().int().nonnegative(),
});

/**
 * The data of the broadcast frames on `GET /v1/videos/:id/events`, by SSE event name; the
 * snapshot carries `live` only while the video is `LIVE`.
 */
export const LiveVideoEventSchemas = {
  snapshot: z.object({
    live: LiveViewersSchema.extend({ status: z.enum(LIVE_STREAM_STATUSES) }).optional(),
  }),
  'live.viewers': LiveViewersSchema,
  'live.status': z.object({ liveStreamId: z.uuid(), status: z.enum(LIVE_STREAM_STATUSES) }),
};

export type LiveStreamPublicView = z.infer<typeof LiveStreamSchema>;
export type LiveChatMode = z.infer<typeof LiveChatModeSchema>;
export type LiveOverlayView = z.infer<typeof getLiveOverlay.result>;
