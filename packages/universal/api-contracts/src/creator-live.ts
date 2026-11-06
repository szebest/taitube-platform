import { LIVE_STREAM_STATUSES, VIDEO_VISIBILITIES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { LIVE_STREAM_DETAILS_BOUNDS } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { LiveChatModeSchema } from './live';

const LiveStreamIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid live stream ID format' }),
});

const VisibilitySchema = z.enum(VIDEO_VISIBILITIES);

const IngestSchema = z.object({
  rtmpUrl: z.string().describe('The server URL OBS takes, without the key'),
  streamKey: z.string().describe('The key OBS takes; it stays the same across broadcasts'),
  whipUrl: z.string().describe('MediaMTX WHIP page and endpoint for a browser broadcast'),
  overlayToken: z.string().describe('Opens `/v1/live/overlay/:token`, for an OBS browser source'),
  controlToken: z.string().describe('Opens the companion socket, for a Stream Deck'),
});

const LiveStreamSchema = z.object({
  id: z.uuid().describe('Live stream UUIDv7 identifier'),
  status: z.enum(LIVE_STREAM_STATUSES),
  title: z.string(),
  description: z.string(),
  visibility: VisibilitySchema.describe('Who may watch while it is live'),
  archiveVisibility: VisibilitySchema.describe(
    'What the recording becomes when the broadcast ends'
  ),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  videoId: z.uuid().nullable().describe('The video the broadcast is, once it went live'),
  ingest: IngestSchema.nullable().describe('Where to publish; null once the broadcast ended'),
  chat: LiveChatModeSchema,
});

const UpdateLiveStreamBodySchema = z.object({
  title: z.string().max(LIVE_STREAM_DETAILS_BOUNDS.title.maxLength).optional(),
  description: z.string().max(LIVE_STREAM_DETAILS_BOUNDS.description.maxLength).optional(),
  visibility: VisibilitySchema.optional(),
  archiveVisibility: VisibilitySchema.optional(),
  chatSlowModeSeconds: LiveChatModeSchema.shape.slowModeSeconds.optional(),
  chatSubscribersOnly: z.boolean().optional(),
});

const AUTHENTICATED = { 401: [ErrorCodes.UNAUTHORIZED] } as const;
const OWN_STREAM = {
  ...AUTHENTICATED,
  400: [ErrorCodes.VALIDATION_FAILED],
  404: [ErrorCodes.LIVE_STREAM_NOT_FOUND],
} as const;

export const openMyLiveStream = defineEndpoint({
  method: 'POST',
  path: '/v1/me/live',
  tag: 'Live',
  summary: 'Open my live stream',
  description:
    "The caller's channel stream that is idle or live, minted with a stream key on the first call. Publishing to the RTMP URL with the key, or through the WHIP page, takes it live.",
  status: 200,
  result: LiveStreamSchema,
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.CHANNEL_NOT_FOUND] },
});

export const getMyLiveStream = defineEndpoint({
  method: 'GET',
  path: '/v1/me/live',
  tag: 'Live',
  summary: 'Get my live stream',
  description: "The caller's stream that is idle or live; 404 until one was opened.",
  status: 200,
  result: LiveStreamSchema,
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.LIVE_STREAM_NOT_FOUND] },
});

export const updateMyLiveStream = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/live/:id',
  tag: 'Live',
  summary: 'Edit my live stream',
  description:
    'Title, description, the visibility while live, the visibility of the recording, and the chat mode. The next broadcast keeps them.',
  params: LiveStreamIdParamSchema,
  body: UpdateLiveStreamBodySchema,
  status: 200,
  result: LiveStreamSchema,
  errors: { ...OWN_STREAM, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const stopMyLiveStream = defineEndpoint({
  method: 'POST',
  path: '/v1/me/live/:id/stop',
  tag: 'Live',
  summary: 'Stop my broadcast',
  description:
    'Drops the publisher. The broadcast ends and its recording is published once the packager has written its last segment.',
  params: LiveStreamIdParamSchema,
  status: 202,
  result: LiveStreamSchema,
  errors: {
    ...OWN_STREAM,
    409: [ErrorCodes.LIVE_STREAM_NOT_LIVE],
    503: [ErrorCodes.LIVE_GATEWAY_UNAVAILABLE, ErrorCodes.DATABASE_UNAVAILABLE],
  },
});

export type LiveStreamView = z.infer<typeof LiveStreamSchema>;
export type UpdateLiveStreamBody = z.infer<typeof UpdateLiveStreamBodySchema>;
