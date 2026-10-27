import {
  CAPTION_KINDS,
  CAPTION_STATUSES,
  MAX_CAPTION_FILE_BYTES,
  MAX_CAPTION_TRACKS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const VideoIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid video ID format' }) });

const LanguageSchema = z.string().describe('BCP 47 language tag, such as en or pt-BR');

const TrackParamSchema = VideoIdParamSchema.extend({ lang: LanguageSchema });

const CaptionTrackSchema = z.object({
  id: z.uuid(),
  language: z
    .string()
    .nullable()
    .describe('null while a generated track has not detected its language yet'),
  kind: z
    .enum(CAPTION_KINDS)
    .describe(
      'auto: speech-to-text; edited: speech-to-text a creator corrected; uploaded: a .vtt file'
    ),
  status: z.enum(CAPTION_STATUSES),
  url: z.string().nullable().describe('The WebVTT file on the CDN, once the track is ready'),
  reason: z
    .string()
    .nullable()
    .optional()
    .describe('Why a track is failed or disabled; shown to whoever may manage the captions'),
  version: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'The version a cue edit is checked against; shown to whoever may manage the captions'
    ),
});

const CaptionSettingsSchema = z.object({
  autoCaptions: z.boolean().nullable().describe("The video's switch; null follows the channel"),
  channelDefault: z.boolean(),
});

const CaptionListSchema = z.object({
  tracks: z.array(CaptionTrackSchema),
  settings: CaptionSettingsSchema.optional().describe(
    'Present for whoever may manage the captions'
  ),
});

const TranscriptSchema = z.object({
  captionId: z.uuid(),
  language: z.string().nullable(),
  kind: z.enum(CAPTION_KINDS),
  cues: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
      text: z.string(),
    })
  ),
});

const READ_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
} as const;

const MANAGE_ERRORS = { ...READ_ERRORS, 403: [ErrorCodes.FORBIDDEN] } as const;

const TRACK_ERRORS = {
  ...MANAGE_ERRORS,
  404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CAPTION_NOT_FOUND],
  422: [ErrorCodes.VALIDATION_FAILED],
} as const;

export const listCaptions = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/captions',
  tag: 'Captions',
  summary: 'List the caption tracks of a video',
  description:
    "Whoever may watch the video may read its captions. A viewer sees the ready tracks, without the generated one when the video's switch is off; the owner sees every track with its status, reason and version, and the switch.",
  anonymous: true,
  params: VideoIdParamSchema,
  status: 200,
  result: CaptionListSchema,
  errors: READ_ERRORS,
});

export const getTranscript = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/transcript',
  tag: 'Captions',
  summary: 'Read the transcript of a video',
  description:
    'The cues of the ready track in lang, by default the generated track when it is ready, else the first ready track. q keeps the cues whose words match it.',
  anonymous: true,
  params: VideoIdParamSchema,
  query: z.object({
    lang: LanguageSchema.optional(),
    q: z.string().optional().describe('Words to find in the transcript'),
  }),
  status: 200,
  result: TranscriptSchema,
  errors: {
    ...READ_ERRORS,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.CAPTION_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const updateCaptionSettings = defineEndpoint({
  method: 'PATCH',
  path: '/v1/videos/:id/captions',
  tag: 'Captions',
  summary: 'Switch generated captions on or off for a video',
  description:
    'null follows the channel default. Switching on a video with no generated track, or a failed one, starts speech-to-text; switching off hides the generated track from viewers and keeps it. With captions turned off for the platform the switch is stored and nothing runs.',
  params: VideoIdParamSchema,
  body: z.object({ autoCaptions: z.boolean().nullable() }),
  status: 200,
  result: CaptionListSchema,
  errors: MANAGE_ERRORS,
});

export const uploadCaptionTrack = defineEndpoint({
  method: 'PUT',
  path: '/v1/videos/:id/captions/:lang',
  tag: 'Captions',
  summary: 'Upload a WebVTT caption track',
  description: `A text/vtt body up to ${MAX_CAPTION_FILE_BYTES} bytes creates or replaces the track of that language. A malformed file is a 422 naming its line; a video holds at most ${MAX_CAPTION_TRACKS} tracks.`,
  params: TrackParamSchema,
  body: z.string().describe('The WebVTT file'),
  status: 200,
  result: CaptionTrackSchema,
  errors: {
    ...MANAGE_ERRORS,
    409: [ErrorCodes.CAPTION_TRACK_LIMIT, ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const editCaptionCues = defineEndpoint({
  method: 'PATCH',
  path: '/v1/videos/:id/captions/:lang',
  tag: 'Captions',
  summary: 'Correct the text of caption cues',
  description:
    'Rewrites the text of the named cues; timing stays. A generated track becomes edited, so a regenerate asks before replacing it. A stale version is a 409.',
  params: TrackParamSchema,
  body: z.object({
    version: z.number().int().positive().describe('The track version the edit was based on'),
    cues: z.array(z.object({ index: z.number().int().nonnegative(), text: z.string() })).min(1),
  }),
  status: 200,
  result: CaptionTrackSchema,
  errors: { ...TRACK_ERRORS, 409: [ErrorCodes.VERSION_CONFLICT] },
});

export const deleteCaptionTrack = defineEndpoint({
  method: 'DELETE',
  path: '/v1/videos/:id/captions/:lang',
  tag: 'Captions',
  summary: 'Delete a caption track',
  description: 'Removes the track of that language and its WebVTT file.',
  params: TrackParamSchema,
  status: 204,
  result: z.null().describe('Track deleted'),
  errors: TRACK_ERRORS,
});

export const generateCaptions = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/captions/generate',
  tag: 'Captions',
  summary: 'Generate or regenerate captions by speech-to-text',
  description:
    'Starts speech-to-text for the generated track, in language when given, else detected. An edited track is replaced only with overwrite: true; without it the answer is 409 CAPTION_OVERWRITE_UNCONFIRMED. With captions turned off for the platform the track waits as pending.',
  params: VideoIdParamSchema,
  body: z.object({
    language: LanguageSchema.nullish(),
    overwrite: z.boolean().optional().describe('Replace a track the creator edited'),
  }),
  status: 202,
  result: CaptionTrackSchema,
  errors: {
    ...MANAGE_ERRORS,
    409: [ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED, ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const setChannelAutoCaptions = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/auto-captions',
  tag: 'Captions',
  summary: 'Set the channel default for generated captions',
  description:
    'Whether videos uploaded from now on get generated captions when their own switch is null. Existing videos are not captioned by it.',
  body: z.object({ enabled: z.boolean() }),
  status: 200,
  result: z.object({ enabled: z.boolean() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type CaptionTrackView = z.infer<typeof CaptionTrackSchema>;
export type CaptionListView = z.infer<typeof CaptionListSchema>;
export type TranscriptView = z.infer<typeof TranscriptSchema>;
