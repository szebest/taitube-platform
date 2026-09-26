import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema, VideoSchema } from './video-resource';

/**
 * The same read as `GET /v1/videos/:id`, answered honestly. The public route renders "you may not
 * read this" as a 404 so that a private video is indistinguishable from a missing one; an operator
 * needs to know which it is, and the service is not asked to choose between them (SDD ADR-24).
 */
export const getVideoAsAdmin = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/videos/:id',
  tag: 'Admin',
  summary: 'Get video details as an operator',
  description:
    'Retrieves full video details for an operator. Unlike the public route, a video the caller may not read is reported as 403 rather than disguised as 404.',
  params: VideoIdParamSchema,
  status: 200,
  result: VideoSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const takeDownVideo = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/videos/:id/takedown',
  tag: 'Admin',
  summary: 'Take down a video that violates the terms',
  description:
    'Admin only. Moves the video to REJECTED and private in one step and appends video.taken_down with the reason. Its owner can still edit it but not publish it again.',
  params: VideoIdParamSchema,
  body: z.object({
    reason: z.string().max(500).optional().describe('Why the video came down, kept in its events'),
  }),
  status: 200,
  result: VideoSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
  },
});
