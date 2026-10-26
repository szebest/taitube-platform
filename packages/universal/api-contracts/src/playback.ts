import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const PLAYBACK_EVENT_TYPES = [
  'playback_start',
  'heartbeat',
  'rebuffer',
  'quality_change',
  'playback_ended',
] as const;

const MAX_SEGMENT_SECONDS = 600;
const MAX_REBUFFERING_MS = 600_000;
const MAX_RENDITION_LENGTH = 16;

const PlaybackEventSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  sessionUuid: z
    .uuid()
    .describe('Ephemeral playback UUID the client generates for each video load, never reused'),
  eventType: z.enum(PLAYBACK_EVENT_TYPES).describe('The milestone or QoS event being reported'),
  currentTime: z.number().nonnegative().describe('Playback position in seconds'),
  duration: z.number().positive().describe('Video duration in seconds, as the player reports it'),
  rebufferingMs: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_REBUFFERING_MS)
    .default(0)
    .describe('Milliseconds spent stalled since the previous event'),
  watchedSeconds: z
    .number()
    .nonnegative()
    .max(MAX_SEGMENT_SECONDS)
    .default(0)
    .describe('Seconds actually played since the previous event'),
  rendition: z
    .string()
    .max(MAX_RENDITION_LENGTH)
    .regex(/^[\w-]+$/)
    .optional()
    .describe('Rendition playing, such as 720p'),
});

export const recordPlayback = defineEndpoint({
  method: 'POST',
  path: '/v1/telemetry/playback',
  tag: 'Telemetry',
  summary: 'Record a playback telemetry event',
  description:
    'First-party playback QoS and retention milestones. Carries no cookie or personal identifier, only an ephemeral session UUID. Also accepted as text/plain, which is what navigator.sendBeacon sends without a CORS preflight. Always answers 204: an event that cannot be buffered is dropped, never retried.',
  anonymous: true,
  body: PlaybackEventSchema,
  status: 204,
  result: z.null().describe('Event accepted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    413: [ErrorCodes.VALIDATION_FAILED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type PlaybackEventType = (typeof PLAYBACK_EVENT_TYPES)[number];
export type PlaybackEvent = z.infer<typeof PlaybackEventSchema>;
