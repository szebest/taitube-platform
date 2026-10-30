import { LIBRARY_SORTS, SORT_ORDERS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { CursorSchema, PageLimitSchema } from './pagination';
import {
  VideoIdParamSchema,
  VideoSchema,
  VideoStatusSchema,
  VideoSummarySchema,
  VideoVisibilitySchema,
} from './video-resource';

const AdminVideosQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
  sort: z
    .enum(LIBRARY_SORTS)
    .default('newest')
    .describe(
      'newest by upload time, most views, likes or comments, or title by character code, uppercase before lowercase'
    ),
  order: z.enum(SORT_ORDERS).default('desc').describe('desc puts the largest or newest first'),
  status: VideoStatusSchema.exclude(['DELETED'])
    .optional()
    .describe('Only videos in this pipeline status'),
  visibility: VideoVisibilitySchema.optional().describe('Only videos with this visibility'),
  categoryId: z.uuid().optional().describe('Only videos in this category'),
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Only videos whose title contains this text, ignoring case'),
});

const AdminVideoSchema = VideoSummarySchema.pick({
  id: true,
  ownerId: true,
  title: true,
  visibility: true,
  status: true,
  posterUrl: true,
  thumbnailUrl: true,
  channel: true,
  viewsCount: true,
  likesCount: true,
  categoryId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

const AdminVideosResponseSchema = z.object({
  items: z.array(AdminVideoSchema).describe('Page of videos from every owner'),
  nextCursor: z.string().nullable().describe('Opaque cursor for the next page of the same walk'),
});

export const listAdminVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/videos',
  tag: 'Admin',
  summary: 'List every video',
  description:
    'Admin only. Every owner video except deleted ones, with its owner channel. Keyset-paginated on the chosen sort and order, then id; a cursor only continues the walk it came from.',
  query: AdminVideosQuerySchema,
  status: 200,
  result: AdminVideosResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

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
