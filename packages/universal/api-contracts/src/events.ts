import { CAPTION_KINDS, type UserEvent } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { NotificationSchema } from './notifications';
import { PreferenceSectionSchema } from './preferences';
import { VideoIdParamSchema, VideoStatusSchema } from './video-resource';

/** A `Last-Event-ID` the stream resumes from; anything else opens it as if none was sent. */
export const LastEventIdSchema = z.string().regex(/^\d{1,15}$/);

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

const UserEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('video.processing'),
    payload: z.object({ videoId: z.uuid(), change: VideoProcessingChangeSchema }),
  }),
  z.object({
    type: z.literal('preferences.updated'),
    payload: z.object({
      sections: z.array(PreferenceSectionSchema),
      version: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal('notification.created'),
    payload: z.object({
      notification: NotificationSchema,
      unreadCount: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('notification.read'),
    payload: z.discriminatedUnion('scope', [
      z.object({
        scope: z.literal('ids'),
        ids: z.array(z.uuid()),
        unreadCount: z.number().int().nonnegative(),
      }),
      z.object({ scope: z.literal('all'), unreadCount: z.number().int().nonnegative() }),
    ]),
  }),
  z.object({
    type: z.literal('comment.created'),
    payload: z.object({
      comment: z.object({
        id: z.uuid(),
        parentId: z.uuid().nullable(),
        content: z.string(),
        createdAt: z.string(),
        author: z.object({
          userId: z.uuid(),
          handle: z.string().nullable(),
          displayName: z.string().nullable(),
        }),
      }),
      video: z.object({ id: z.uuid(), title: z.string() }),
    }),
  }),
  z.object({
    type: z.literal('captions.ready'),
    payload: z.object({
      videoId: z.uuid(),
      track: z.object({ id: z.uuid(), language: z.string(), kind: z.enum(CAPTION_KINDS) }),
    }),
  }),
  z.object({
    type: z.literal('captions.failed'),
    payload: z.object({ videoId: z.uuid(), captionId: z.uuid(), reason: z.string() }),
  }),
]) satisfies z.ZodType<UserEvent>;

export type { UserEvent };

/**
 * `fresh` opened without `Last-Event-ID`, `replayed` sent every event after it, `expired` could not
 * (the event left the log, or too many followed), so the client refetches what it shows.
 */
const HelloEventSchema = z.object({
  type: z.literal('hello'),
  payload: z.object({
    resume: z.enum(['fresh', 'replayed', 'expired']),
    unreadNotifications: z.number().int().nonnegative(),
  }),
});
type HelloEvent = z.infer<typeof HelloEventSchema>;
export type StreamResume = HelloEvent['payload']['resume'];

const UserStreamEventSchema = z
  .discriminatedUnion('type', [HelloEventSchema, ...UserEventSchema.options])
  .describe(
    'text/event-stream: each frame is named by its type and carries one of these as data, hello first and without an id'
  );

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
