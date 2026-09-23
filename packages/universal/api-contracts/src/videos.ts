import { ErrorCodes } from '@vp/errors';
import { Base64UrlCursorCodec } from '@vp/pagination';
import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';
import { CursorSchema, PageLimitSchema } from './pagination.js';
import {
  VideoIdParamSchema,
  VideoListResponseSchema,
  VideoSchema,
  VideoStatusSchema,
  VideoVisibilitySchema,
} from './video-resource.js';

function isKeysetCursor(cursor: string): boolean {
  const decoded = new Base64UrlCursorCodec().decode(cursor);
  if (!decoded.ok) return false;

  const createdAt = decoded.value['createdAt'];
  return (
    typeof createdAt === 'string' &&
    !Number.isNaN(new Date(createdAt).getTime()) &&
    typeof decoded.value['id'] === 'string'
  );
}

export const ListVideosQuerySchema = z.object({
  cursor: CursorSchema.refine(isKeysetCursor, { message: 'Invalid pagination cursor' }).optional(),
  limit: PageLimitSchema,
  status: VideoStatusSchema.optional().describe('Filter videos by pipeline status'),
});

export const UpdateVideoMetadataSchema = z.object({
  title: z.string().max(255).optional().describe('Updated video title'),
  description: z.string().max(4000).optional().describe('Updated video description'),
  visibility: VideoVisibilitySchema.optional().describe(
    'Updated visibility: private, unlisted, or public'
  ),
  version: z.number().int().nonnegative().describe('Current optimistic locking version (required)'),
});

export const listVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/videos',
  tag: 'Videos',
  summary: 'List caller videos with keyset pagination',
  description:
    'Keyset-paginated on (created_at, id), stable under concurrent inserts, scoped to the caller. nextCursor is opaque base64url.',
  query: ListVideosQuerySchema,
  status: 200,
  result: VideoListResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const getVideo = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id',
  tag: 'Videos',
  summary: 'Get video details',
  description:
    'Retrieves full video details. Public/unlisted videos are readable by anyone; private videos require owner or admin authentication (returns 404 for non-owners). Public playback URL uses CDN (PRD OQ-2).',
  anonymous: true,
  params: VideoIdParamSchema,
  status: 200,
  result: VideoSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const updateVideo = defineEndpoint({
  method: 'PATCH',
  path: '/v1/videos/:id',
  tag: 'Videos',
  summary: 'Edit video metadata with optimistic locking',
  description:
    'Edits title, description, or visibility (private <-> unlisted <-> public). Requires expected version; returns 409 VERSION_CONFLICT if stale.',
  params: VideoIdParamSchema,
  body: UpdateVideoMetadataSchema,
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

export const deleteVideo = defineEndpoint({
  method: 'DELETE',
  path: '/v1/videos/:id',
  tag: 'Videos',
  summary: 'Soft delete video',
  description:
    'Transitions video status to DELETED and enqueues housekeeping purge. Only owner or admin may delete.',
  params: VideoIdParamSchema,
  status: 202,
  result: z.object({
    videoId: z.string().uuid(),
    status: z.literal('DELETED'),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
  },
});

export const reprocessVideo = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/reprocess',
  tag: 'Videos',
  summary: 'Re-run transcoding pipeline',
  description:
    'Re-enqueues video into probe queue with an incremented generation. Owner or admin only; rate-limited.',
  params: VideoIdParamSchema,
  body: z.object({ renditions: z.array(z.string()).optional() }).nullish(),
  status: 202,
  result: z.object({
    videoId: z.string().uuid(),
    status: z.literal('PROBING'),
    generation: z.number(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type ListVideosQuery = z.input<typeof ListVideosQuerySchema>;
export type UpdateVideoMetadata = z.infer<typeof UpdateVideoMetadataSchema>;
