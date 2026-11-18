import {
  BULK_EDIT_MAX_IDS,
  CHAPTER_MIN_GAP_MS,
  CHAPTER_TITLE_MAX_LENGTH,
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  ENTITY_REVISION_KEEP,
  MAX_CORRECTIONS_PER_VIDEO,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { CursorSchema, OptionalPageLimitSchema } from './pagination';
import {
  VideoChapterSchema,
  VideoIdParamSchema,
  VideoSchema,
  VideoVisibilitySchema,
} from './video-resource';

const BulkEditBodySchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(BULK_EDIT_MAX_IDS)
    .describe(`The videos to change, 1 to ${BULK_EDIT_MAX_IDS}; a repeated id counts once`),
  patch: z
    .object({
      visibility: VideoVisibilitySchema.optional(),
      categoryId: z.uuid().nullable().optional().describe('Active category, null for none'),
      addTags: z.array(z.string()).optional().describe('Tags to add to every video'),
      removeTags: z.array(z.string()).optional().describe('Tags to take off every video'),
      commentsEnabled: z.boolean().optional(),
    })
    .describe('What to change; at least one field'),
});

const BulkEditItemSchema = z.object({
  id: z.uuid(),
  ok: z.boolean().describe('Whether this video was changed'),
  code: z
    .string()
    .optional()
    .describe('The error code when it was not, as the single edit would have answered'),
});

const BulkEditResultSchema = z.object({
  items: z.array(BulkEditItemSchema).describe('One entry per distinct id, in request order'),
});

const VideoMetadataSnapshotSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  categoryId: z.uuid().nullable(),
  visibility: VideoVisibilitySchema,
  thumbnail: z.object({ source: z.literal('poster') }),
  chapters: z.array(VideoChapterSchema),
  commentsEnabled: z.boolean(),
});

const RevisionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().nonnegative().describe('The video version this state belongs to'),
  snapshot: VideoMetadataSnapshotSchema,
  authorUserId: z
    .uuid()
    .nullable()
    .describe('Who saved it; null for the state before the first edit'),
  restoredFromVersion: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe('The version a restore went back to; null for an ordinary edit'),
  createdAt: z.string().describe('ISO 8601 timestamp'),
});

const RevisionPageSchema = z.object({
  items: z.array(RevisionSchema),
  nextCursor: z.string().nullable(),
});

const RevisionParamsSchema = VideoIdParamSchema.extend({ revisionId: z.uuid() });

const RestoreBodySchema = z.object({
  version: z
    .number()
    .int()
    .nonnegative()
    .describe('The video version the restore was made against'),
});

const ChapterSuggestionSchema = z.object({
  startMs: z.number().int().nonnegative(),
  title: z.string(),
});

const ReplaceChaptersBodySchema = z.object({
  chapters: z
    .array(VideoChapterSchema)
    .describe(
      `The whole set: empty to clear, else at least 3, the first at 0, ${CHAPTER_MIN_GAP_MS / 1000} seconds apart, titles up to ${CHAPTER_TITLE_MAX_LENGTH} characters`
    ),
  version: z.number().int().nonnegative().describe('The version the edit was made against'),
});

const CorrectionSchema = z.object({
  id: z.uuid(),
  videoId: z.uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
});

const CorrectionListSchema = z.object({ items: z.array(CorrectionSchema) });

const CorrectionBodySchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z
    .number()
    .int()
    .nonnegative()
    .describe(
      `${CORRECTION_MIN_MS / 1000} to ${CORRECTION_MAX_MS / 1000} seconds after the start, inside the video`
    ),
  text: z.string().describe(`The correction, up to ${CORRECTION_TEXT_MAX_LENGTH} characters`),
});

const CorrectionChangesSchema = CorrectionBodySchema.partial().refine(
  (changes) => Object.keys(changes).length > 0,
  { message: 'Name at least one field to change' }
);

const CorrectionParamsSchema = VideoIdParamSchema.extend({ correctionId: z.uuid() });

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const bulkEditCreatorVideos = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/bulk',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Edit up to 100 videos at once',
  description:
    'Each id goes through the single edit, so its rule and its version check apply to it alone: one refusal never fails the batch. The answer is 200 with one entry per id, also when every id failed; an id the caller cannot read answers VIDEO_NOT_FOUND.',
  body: BulkEditBodySchema,
  status: 200,
  result: BulkEditResultSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const listVideoRevisions = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/revisions',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'List the metadata history of a video',
  description: `Newest first, keyset-paginated on the version. Every saved edit is one entry, and the last ${ENTITY_REVISION_KEEP} are kept.`,
  params: VideoIdParamSchema,
  query: z.object({ cursor: CursorSchema.optional(), limit: OptionalPageLimitSchema }),
  status: 200,
  result: RevisionPageSchema,
  errors: { ...AUTHENTICATED, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const restoreVideoRevision = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/revisions/:revisionId/restore',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Restore an earlier version of the metadata',
  description:
    'A normal edit under the current version, so a stale version answers 409 VERSION_CONFLICT. It writes a new revision from the old snapshot and changes only the fields that differ.',
  params: RevisionParamsSchema,
  body: RestoreBodySchema,
  status: 200,
  result: VideoSchema,
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.REVISION_NOT_FOUND, ErrorCodes.CATEGORY_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const getChapterSuggestions = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/chapter-suggestions',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Suggest chapters from the transcript',
  description:
    'A pure function over the cues of the ready transcript: windows of about 30 seconds, a boundary where the topic changes and at least 90 seconds have passed, at most 12. Nothing is saved, and the answer is empty without a transcript.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(ChapterSuggestionSchema) }),
  errors: AUTHENTICATED,
});

export const replaceVideoChapters = defineEndpoint({
  method: 'PUT',
  path: '/v1/videos/:id/chapters',
  scope: 'videos:write',
  tag: 'Videos',
  summary: 'Replace the chapters of a video',
  description:
    'A normal edit under the version it was made against: 409 VERSION_CONFLICT when the video moved on. It appends a revision like any other edit.',
  params: VideoIdParamSchema,
  body: ReplaceChaptersBodySchema,
  status: 200,
  result: VideoSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const listVideoCorrections = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/corrections',
  scope: 'videos:read',
  anonymous: true,
  tag: 'Videos',
  summary: 'List the corrections of a video',
  description: 'Open to anyone who can watch the video, in playback order.',
  params: VideoIdParamSchema,
  status: 200,
  result: CorrectionListSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const createVideoCorrection = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/corrections',
  scope: 'videos:write',
  tag: 'Videos',
  summary: 'Add a correction card to a video',
  description: `A card laid over the player while the playhead is in its range. At most ${MAX_CORRECTIONS_PER_VIDEO} per video.`,
  params: VideoIdParamSchema,
  body: CorrectionBodySchema,
  status: 201,
  result: CorrectionSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.CORRECTION_LIMIT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const updateVideoCorrection = defineEndpoint({
  method: 'PATCH',
  path: '/v1/videos/:id/corrections/:correctionId',
  scope: 'videos:write',
  tag: 'Videos',
  summary: 'Change a correction',
  description:
    'Changes the range or the text; the fields left out stay. The same permission as adding one.',
  params: CorrectionParamsSchema,
  body: CorrectionChangesSchema,
  status: 200,
  result: CorrectionSchema,
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CORRECTION_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const deleteVideoCorrection = defineEndpoint({
  method: 'DELETE',
  path: '/v1/videos/:id/corrections/:correctionId',
  scope: 'videos:write',
  tag: 'Videos',
  summary: 'Remove a correction',
  description: 'The same permission as adding one.',
  params: CorrectionParamsSchema,
  status: 204,
  result: z.null().describe('Correction removed'),
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CORRECTION_NOT_FOUND],
  },
});
