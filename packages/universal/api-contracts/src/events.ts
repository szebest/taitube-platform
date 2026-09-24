import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const EventStreamQuerySchema = z
  .object({
    'last-event-id': z.string().optional().describe('Replay events after this ID'),
  })
  .optional();

const EventStreamSchema = z.string().describe('text/event-stream Server-Sent Events stream');

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
  summary: 'SSE stream for all user videos',
  description: 'Streams realtime video events for all videos owned by the authenticated caller.',
  query: EventStreamQuerySchema,
  status: 200,
  result: EventStreamSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});
