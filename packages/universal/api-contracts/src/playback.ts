import { EXPERIMENT_VARIANT_IDS, VIEW_DEVICES } from '@vp/domain';
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

const ExperimentShownSchema = z.object({
  experimentId: z.uuid(),
  variantId: z.enum(EXPERIMENT_VARIANT_IDS),
});

export const MAX_IMPRESSIONS_PER_BATCH = 50;

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
  device: z
    .enum(VIEW_DEVICES)
    .optional()
    .describe(
      'Coarse device class the client decided from its pointer and screen; absent counts as unknown'
    ),
  shareLinkId: z
    .uuid()
    .optional()
    .describe('The share link the page was opened through, as the video read answered it'),
  experiment: ExperimentShownSchema.optional().describe(
    'The test variant the video read answered; starts and watch seconds count toward it'
  ),
});

export const recordPlayback = defineEndpoint({
  method: 'POST',
  path: '/v1/telemetry/playback',
  tag: 'Telemetry',
  summary: 'Record a playback telemetry event',
  description:
    'First-party playback QoS and retention milestones. Carries no cookie or personal identifier, only an ephemeral session UUID. Also accepted as text/plain, which is what navigator.sendBeacon sends without a CORS preflight. Counts the view once a session has watched the minimum, and adds the watched seconds of each event to the watch time of the day. Always answers 204: an event that cannot be buffered is dropped, never retried.',
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

export const recordImpressions = defineEndpoint({
  method: 'POST',
  path: '/v1/telemetry/impressions',
  tag: 'Telemetry',
  summary: 'Record test variant impressions',
  description:
    'A card showing a test variant came into view. No cookie or identifier, only the variant shown. Also accepted as text/plain for navigator.sendBeacon. Always answers 204: an impression that cannot be buffered is dropped.',
  anonymous: true,
  body: z.object({
    items: z
      .array(ExperimentShownSchema.extend({ videoId: z.uuid() }))
      .min(1)
      .max(MAX_IMPRESSIONS_PER_BATCH),
  }),
  status: 204,
  result: z.null().describe('Impressions accepted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    413: [ErrorCodes.VALIDATION_FAILED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type PlaybackEventType = (typeof PLAYBACK_EVENT_TYPES)[number];
export type PlaybackEvent = z.infer<typeof PlaybackEventSchema>;
export type ImpressionBatch = z.infer<typeof recordImpressions.body>;
