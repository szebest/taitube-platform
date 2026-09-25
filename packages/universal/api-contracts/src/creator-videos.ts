import { CREATOR_LIBRARY_SORTS } from '@vp/domain';
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

const CreatorLibraryQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
  sort: z
    .enum(CREATOR_LIBRARY_SORTS)
    .default('newest')
    .describe('newest by upload time, or most views, likes or comments first'),
  status: VideoStatusSchema.exclude(['DELETED'])
    .optional()
    .describe('Only videos in this pipeline status'),
  visibility: VideoVisibilitySchema.optional().describe('Only videos with this visibility'),
});

const ThumbnailSelectionSchema = z
  .discriminatedUnion('source', [z.object({ source: z.literal('poster') })])
  .describe('The thumbnail to show; the generated poster until custom uploads exist');

const UpdateCreatorVideoSchema = z.object({
  title: z.string().max(255).optional().describe('Video title'),
  description: z.string().max(5000).optional().describe('Video description'),
  visibility: VideoVisibilitySchema.optional(),
  categoryId: z.string().uuid().nullable().optional().describe('Active category, null for none'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Replaces every tag; at most 30, each 1 to 30 characters once trimmed'),
  selectedThumbnail: ThumbnailSelectionSchema.optional(),
  version: z.number().int().nonnegative().describe('The version the edit was made against'),
});

const CreatorVideoSchema = VideoSummarySchema.extend({
  commentsCount: z.number().int().nonnegative().describe('Comments on the video'),
  tags: z.array(z.string()).describe('Tags the creator set'),
});

const CreatorLibraryResponseSchema = z.object({
  items: z.array(CreatorVideoSchema).describe('Page of the caller videos'),
  nextCursor: z.string().nullable().describe('Opaque cursor for the next page of the same sort'),
});

const CREATOR_VIDEO_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const listCreatorVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos',
  tag: 'Creator Studio',
  summary: 'List the caller video library',
  description:
    'Every video the caller owns except deleted ones, with its counters. Keyset-paginated on the chosen sort, then id; a cursor only continues the sort it came from.',
  query: CreatorLibraryQuerySchema,
  status: 200,
  result: CreatorLibraryResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const updateCreatorVideo = defineEndpoint({
  method: 'PATCH',
  path: '/v1/creator/videos/:id',
  tag: 'Creator Studio',
  summary: 'Edit video metadata, tags, category and thumbnail',
  description:
    'Owner or admin. Requires the version the edit was made against and answers 409 VERSION_CONFLICT when the video moved on. A video an admin took down keeps its visibility until an admin changes it.',
  params: VideoIdParamSchema,
  body: UpdateCreatorVideoSchema,
  status: 200,
  result: VideoSchema,
  errors: {
    ...CREATOR_VIDEO_ERRORS,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CATEGORY_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const deleteCreatorVideo = defineEndpoint({
  method: 'DELETE',
  path: '/v1/creator/videos/:id',
  tag: 'Creator Studio',
  summary: 'Delete a video from the library',
  description:
    'Owner or admin. Moves the video to DELETED and appends video.deleted; housekeeping purges its objects afterwards.',
  params: VideoIdParamSchema,
  status: 202,
  result: z.object({ videoId: z.string().uuid(), status: z.literal('DELETED') }),
  errors: { ...CREATOR_VIDEO_ERRORS, 409: [ErrorCodes.VERSION_CONFLICT] },
});
