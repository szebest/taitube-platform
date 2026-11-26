import { MS_PER_DAY } from '@kit/primitives';
import {
  BLUR_MAX_STRENGTH,
  BLUR_MIN_STRENGTH,
  BLUR_SHAPES,
  EDIT_BASE_RETENTION_MS,
  GENERATION_KINDS,
  GENERATION_STATUSES,
  MAX_BLURS,
  MAX_CLIP_SUGGESTIONS,
  VIDEO_EDIT_STATUSES,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const TimeRangeSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});

const ShareSchema = z.number().min(0).max(1);

const BlurSchema = TimeRangeSchema.extend({
  shape: z.enum(BLUR_SHAPES),
  x: ShareSchema.describe('Left edge, a share of the frame width'),
  y: ShareSchema.describe('Top edge, a share of the frame height'),
  w: ShareSchema,
  h: ShareSchema,
  strength: z.number().int().min(BLUR_MIN_STRENGTH).max(BLUR_MAX_STRENGTH),
});

const EditListSchema = z.object({
  trim: TimeRangeSchema.nullable().describe('The part of the base generation kept'),
  blurs: z.array(BlurSchema).max(MAX_BLURS),
});

const VideoEditSchema = EditListSchema.extend({
  baseGeneration: z.number().int().min(1),
  generation: z.number().int().min(1).describe('The generation the list renders into'),
  status: z.enum(VIDEO_EDIT_STATUSES),
  updatedAt: z.string().describe('ISO 8601'),
});

const GenerationSchema = z.object({
  generation: z.number().int().min(1),
  kind: z.enum(GENERATION_KINDS),
  status: z.enum(GENERATION_STATUSES),
  durationMs: z.number().int().nullable(),
  needsReview: z
    .boolean()
    .describe(
      'The duration moved more than 2 seconds: chapters, corrections and captions may be off'
    ),
  errorCode: z.string().nullable(),
  purgeAfter: z.string().nullable().describe('ISO 8601; when a retired generation is deleted'),
  createdAt: z.string().describe('ISO 8601'),
});

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const listVideoGenerations = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/generations',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'The generations of a video and its edit list',
  description:
    'Newest first. `editBase` is the generation a new edit renders from and the timeline its ranges are on; `edit` is the list saved over it, or null.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({
    activeGeneration: z.number().int().min(1),
    editBase: z.object({ generation: z.number().int().min(1), durationMs: z.number().int() }),
    edit: VideoEditSchema.nullable(),
    items: z.array(GenerationSchema),
  }),
  errors: AUTHENTICATED,
});

export const startVideoReplacement = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/replacement',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Replace the file of a video',
  description:
    'A presigned PUT into a new generation. The video stays READY and plays its current file until the new ladder is complete; the URL, views, likes and comments stay. One replacement or edit at a time.',
  params: VideoIdParamSchema,
  body: z.object({
    filename: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    contentType: z.string(),
  }),
  status: 201,
  result: z.object({
    generation: z.number().int().min(2),
    uploadUrl: z.string(),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string().describe('ISO 8601'),
  }),
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.GENERATION_IN_PROGRESS],
    422: [
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.VALIDATION_FAILED,
    ],
  },
});

export const completeVideoReplacement = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/replacement/complete',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Start rendering an uploaded replacement',
  description:
    'Renders the uploaded file into its generation and swaps it in when done; a failure leaves the video as it is and says so on the event stream.',
  params: VideoIdParamSchema,
  body: z.object({ generation: z.number().int().min(2) }),
  status: 202,
  result: z.object({ generation: z.number().int().min(2), status: z.literal('rendering') }),
  errors: { ...AUTHENTICATED, 409: [ErrorCodes.REPLACEMENT_NOT_UPLOADED] },
});

export const saveVideoEdits = defineEndpoint({
  method: 'PUT',
  path: '/v1/videos/:id/edits',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Trim and blur a video',
  description: `Renders the edit list from the base generation into a new one and swaps it in; chapters and corrections move with the trim. The base is kept ${EDIT_BASE_RETENTION_MS / MS_PER_DAY} days after the last edit, so the edit can be reverted; after that the list is baked in and further edits apply to the current video.`,
  params: VideoIdParamSchema,
  body: EditListSchema,
  status: 202,
  result: VideoEditSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.GENERATION_IN_PROGRESS],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const revertVideoEdits = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/edits/revert',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Revert the trim and blurs',
  description:
    'Swaps the base generation back in, with its chapters, corrections and retention, under the version the creator saw; a stale version is 409 VERSION_CONFLICT.',
  params: VideoIdParamSchema,
  body: z.object({ version: z.number().int().nonnegative() }),
  status: 200,
  result: z.object({ generation: z.number().int().min(1), version: z.number().int() }),
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.NO_EDIT_TO_REVERT, ErrorCodes.VERSION_CONFLICT],
  },
});

export const getClipSuggestions = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/clip-suggestions',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Suggest clips from the retention curve',
  description: `Up to ${MAX_CLIP_SUGGESTIONS} non-overlapping windows of 15 to 45 seconds where viewers were lost least compared with their neighbours, each with the share lost and its chapter. Saves nothing; a suggestion becomes a clip through POST /v1/videos/:id/clips.`,
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({
    items: z.array(
      TimeRangeSchema.extend({ lostShare: ShareSchema, chapterTitle: z.string().nullable() })
    ),
  }),
  errors: AUTHENTICATED,
});

export type VideoGenerationsView = z.infer<typeof listVideoGenerations.result>;
export type ClipSuggestionView = z.infer<typeof getClipSuggestions.result>['items'][number];
