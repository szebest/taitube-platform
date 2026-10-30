import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { VideoIdParamSchema, VideoSummarySchema } from './video-resource';

const ClipIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid clip ID format' }) });

const CreateClipBodySchema = z.object({
  startMs: z.number().int().nonnegative().describe('Where the clip starts in the video'),
  endMs: z
    .number()
    .int()
    .nonnegative()
    .describe(
      `Where the clip ends: ${CLIP_MIN_MS / 1000} to ${CLIP_MAX_MS / 1000} seconds after the start, inside the video`
    ),
  title: z.string().describe('What the clip shows, 1 to 100 characters once tidied'),
});

const ClipSchema = z.object({
  id: z.uuid().describe('Clip UUIDv7 identifier'),
  videoId: z.uuid().describe('The clipped video'),
  userId: z.uuid().describe('The creator'),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  title: z.string(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  video: VideoSummarySchema.describe(
    'The clipped video, enough to render a card or to play the range from its HLS master'
  ),
});

const ClipPageSchema = z.object({
  items: z.array(ClipSchema),
  nextCursor: z.string().nullable(),
});

export const createClip = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/clips',
  tag: 'Clips',
  summary: 'Clip a range of a video',
  description:
    'A clip is a reference to a range of a ready, public video: nothing is transcoded or stored. The range is 5 to 60 seconds long and inside the video. A video the caller cannot read answers 404, an unlisted or private one they can read answers 403.',
  params: VideoIdParamSchema,
  body: CreateClipBodySchema,
  status: 201,
  result: ClipSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const getClip = defineEndpoint({
  method: 'GET',
  path: '/v1/clips/:id',
  tag: 'Clips',
  summary: 'Read a clip',
  description:
    'Open to anyone. A clip lives and dies with the visibility of its video: once the video turns private or is deleted, the clip answers 404.',
  anonymous: true,
  params: ClipIdParamSchema,
  status: 200,
  result: ClipSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CLIP_NOT_FOUND],
  },
});

export const listMyClips = defineEndpoint({
  method: 'GET',
  path: '/v1/me/clips',
  tag: 'Clips',
  summary: 'List my clips',
  description:
    'The caller clips, newest first, keyset-paginated on (created_at, id). A clip of a video the caller can no longer watch drops out of the page. A creator clips are private to them: no route reads another user.',
  query: KeysetQuerySchema,
  status: 200,
  result: ClipPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const deleteClip = defineEndpoint({
  method: 'DELETE',
  path: '/v1/clips/:id',
  tag: 'Clips',
  summary: 'Delete a clip',
  description:
    'Only its creator, or an admin, may delete a clip, also once the video turned private.',
  params: ClipIdParamSchema,
  status: 204,
  result: z.null().describe('Clip deleted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CLIP_NOT_FOUND],
  },
});

export type ClipView = z.infer<typeof ClipSchema>;
export type ClipPageView = z.infer<typeof ClipPageSchema>;
export type CreateClipBody = z.infer<typeof CreateClipBodySchema>;
