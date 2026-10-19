import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema, VideoStatusSchema } from './video-resource';

const EventStreamQuerySchema = z
  .object({
    'last-event-id': z.string().optional().describe('Replay events after this ID'),
  })
  .optional();

const EventStreamSchema = z.string().describe('text/event-stream Server-Sent Events stream');

const VideoProcessingChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('status'), status: VideoStatusSchema }),
  z.object({
    kind: z.literal('progress'),
    rendition: z.string(),
    percent: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
]);

export const UserEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('video.processing'),
    payload: z.object({ videoId: z.uuid(), change: VideoProcessingChangeSchema }),
  }),
]);
export type UserEvent = z.infer<typeof UserEventSchema>;
export type UserEventType = UserEvent['type'];

/**
 * `fresh` opened without `Last-Event-ID`, `replayed` sent every event after it, `expired` could not
 * (the event left the log, or too many followed), so the client refetches what it shows.
 */
const HelloEventSchema = z.object({
  type: z.literal('hello'),
  payload: z.object({ resume: z.enum(['fresh', 'replayed', 'expired']) }),
});
export type HelloEvent = z.infer<typeof HelloEventSchema>;
export type StreamResume = HelloEvent['payload']['resume'];

export const UserStreamEventSchema = z
  .discriminatedUnion('type', [HelloEventSchema, ...UserEventSchema.options])
  .describe(
    'text/event-stream: each frame is named by its type and carries one of these as data, hello first and without an id'
  );
export type UserStreamEvent = z.infer<typeof UserStreamEventSchema>;

/** A user event on `user:{userId}`: `id` is its `user_events` row, absent on a live progress tick. */
export const UserEventFrameSchema = z
  .object({ id: z.number().int().positive().optional() })
  .and(UserEventSchema);
export type UserEventFrame = z.infer<typeof UserEventFrameSchema>;

export const streamVideoEvents = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/events',
  tag: 'Events',
  summary: 'SSE stream for single video',
  description:
    'Streams realtime video progress and status events over Server-Sent Events with snapshot and replay.',
  anonymous: true,
  params: VideoIdParamSchema,
  query: EventStreamQuerySchema,
  status: 200,
  result: EventStreamSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export const streamMyEvents = defineEndpoint({
  method: 'GET',
  path: '/v1/me/events',
  tag: 'Events',
  summary: 'SSE stream of the caller events',
  description:
    'Streams every event for the authenticated caller: hello, the events after Last-Event-ID, then live ones.',
  query: EventStreamQuerySchema,
  status: 200,
  result: UserStreamEventSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});
