import { SECONDS_PER_DAY } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const ViewTelemetrySchema = z.object({
  sessionId: z.string().uuid().describe('Playback session UUID, stable for one viewing'),
  watchSeconds: z
    .number()
    .nonnegative()
    .max(SECONDS_PER_DAY)
    .describe('Seconds of the video the session actually watched'),
  videoDuration: z
    .number()
    .positive()
    .max(SECONDS_PER_DAY)
    .describe('Duration of the video in seconds, as the player reports it'),
});

const ViewReceiptSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
});

export const recordView = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/views',
  tag: 'Views',
  summary: 'Register a playback beacon',
  description:
    'Accepts playback telemetry without touching the database. A beacon under the minimum watch time, or a repeat from the same viewer on the same day, is accepted and not counted.',
  anonymous: true,
  params: VideoIdParamSchema,
  body: ViewTelemetrySchema,
  status: 202,
  result: ViewReceiptSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type ViewTelemetryInput = z.infer<typeof ViewTelemetrySchema>;
export type ViewReceipt = z.infer<typeof ViewReceiptSchema>;
