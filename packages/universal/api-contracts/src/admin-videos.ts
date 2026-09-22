import { ErrorCodes } from '@vp/errors';
import { defineEndpoint } from './endpoint.js';
import { VideoIdParamSchema, VideoSchema } from './video-resource.js';

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
