import {
  CREATOR_SCREENING_REASONS,
  SCREENING_DECISIONS,
  SCREENING_OUTCOMES,
  SCREENING_REASONS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { CursorSchema, OptionalPageLimitSchema } from './pagination';
import { VideoIdParamSchema, VideoStatusSchema } from './video-resource';

const SecondsRangeSchema = z.object({ fromSeconds: z.number(), toSeconds: z.number() });

const MatchedVideoSchema = z
  .object({
    id: z.uuid(),
    title: z.string().nullable(),
    channel: ChannelCardSchema.nullable(),
    thumbnailUrl: z.string().optional(),
    status: VideoStatusSchema.nullable().describe('Null when the matched video is gone'),
    sameChannel: z.boolean().describe('The matched video is on the same channel: advisory only'),
    mirrored: z.boolean(),
    videoCoverage: z.number().nullable().describe('Share of the frames that match, 0 to 1'),
    audioCoverage: z.number().nullable().describe('Share of the audio that matches, 0 to 1'),
    sourceRange: SecondsRangeSchema.nullable().describe('Where the overlap sits in this video'),
    matchedRange: SecondsRangeSchema.nullable().describe(
      'Where the overlap sits in the matched one'
    ),
  })
  .meta({ id: 'ScreeningMatchedVideo' });

const FrameEvidenceSchema = z.object({
  url: z.string().describe('Short-lived signed URL of the flagged frame'),
  timestampSeconds: z.number(),
  score: z.number(),
});

const FindingSchema = z
  .object({
    reason: z.enum(SCREENING_REASONS),
    score: z.number().min(0).max(1).describe('Evidence for a person to read, never a verdict'),
    match: MatchedVideoSchema.nullable(),
    frames: z.array(FrameEvidenceSchema),
    flaggedShare: z.number().nullable().describe('Share of the sampled frames over the threshold'),
    signals: z.array(z.string()).describe('The metadata rules that tripped'),
    profanity: z.array(z.string()),
  })
  .meta({ id: 'ScreeningFinding' });

const AppealSchema = z
  .object({
    id: z.uuid(),
    message: z.string(),
    createdAt: z.string().describe('ISO 8601 creation timestamp'),
    rejectedBy: z.uuid().nullable().describe('The moderator whose rejection is appealed'),
    resolvedAt: z.string().nullable().describe('ISO 8601 resolution timestamp, null while open'),
  })
  .meta({ id: 'ScreeningAppeal' });

const ScreeningCaseSchema = z
  .object({
    id: z.uuid().describe('The screening result this case is about'),
    videoId: z.uuid(),
    title: z.string().nullable(),
    status: VideoStatusSchema,
    channel: ChannelCardSchema.nullable(),
    thumbnailUrl: z.string().optional(),
    outcome: z.enum(SCREENING_OUTCOMES),
    score: z.number().min(0).max(1),
    open: z.boolean().describe('A hold waits for a decision, or a flag has not been looked at'),
    reasons: z.array(FindingSchema).describe('What held the video'),
    flags: z.array(FindingSchema).describe('What only raised the case'),
    decision: z.enum(SCREENING_DECISIONS).nullable(),
    decidedBy: z.uuid().nullable(),
    decidedAt: z.string().nullable(),
    decisionNote: z.string().nullable(),
    appeal: AppealSchema.nullable().describe('The newest appeal on the video'),
    modelVersion: z.string().nullable(),
    thresholdVersion: z.string(),
    createdAt: z.string().describe('ISO 8601 creation timestamp'),
  })
  .meta({ id: 'ScreeningCase' });

const ScreeningDecisionSchema = z
  .object({ videoId: z.uuid(), status: VideoStatusSchema })
  .meta({ id: 'ScreeningDecision' });

const MODERATOR_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
  409: [ErrorCodes.VERSION_CONFLICT],
} as const;

export const listScreeningCases = defineEndpoint({
  method: 'GET',
  path: '/v1/admin/screening',
  tag: 'Admin',
  summary: 'List held and flagged videos',
  description:
    'The upload screening queue for a moderator: open cases first and each group newest first, keyset-paginated. A case carries its score, reasons, the matched video with the overlapping time ranges, flagged frames as signed URLs and the metadata hits.',
  query: z.object({
    cursor: CursorSchema.optional(),
    limit: OptionalPageLimitSchema,
    state: z.enum(['open', 'decided']).optional().describe('Only open or only decided cases'),
  }),
  status: 200,
  result: z.object({ items: z.array(ScreeningCaseSchema), nextCursor: z.string().nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export const approveHeldVideo = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/videos/:id/screening/approve',
  tag: 'Admin',
  summary: 'Approve a held video',
  description:
    'Moves a held video back to PROCESSING and enqueues its package job, which writes the master and makes it READY. The same video is never held again. When the video was rejected and appealed, a moderator other than the one who rejected it decides.',
  params: VideoIdParamSchema,
  status: 200,
  result: ScreeningDecisionSchema,
  errors: MODERATOR_ERRORS,
});

export const rejectHeldVideo = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/videos/:id/screening/reject',
  tag: 'Admin',
  summary: 'Reject a held video',
  description:
    'Moves a held video to REJECTED with a reason the creator reads and can appeal. When the video was appealed, a moderator other than the one who rejected it decides.',
  params: VideoIdParamSchema,
  body: z.object({
    reason: z.string().trim().min(1).max(500).describe('Why the video is rejected'),
  }),
  status: 200,
  result: ScreeningDecisionSchema,
  errors: MODERATOR_ERRORS,
});

export const dismissScreeningFlags = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/videos/:id/screening/dismiss',
  tag: 'Admin',
  summary: 'Dismiss the flags on a video',
  description:
    'Closes the flags of a video that stayed public, without changing its state. The same finding is not raised again.',
  params: VideoIdParamSchema,
  status: 200,
  result: ScreeningDecisionSchema,
  errors: MODERATOR_ERRORS,
});

const CreatorScreeningSchema = z
  .object({
    videoId: z.uuid(),
    status: VideoStatusSchema,
    reasons: z
      .array(z.enum(CREATOR_SCREENING_REASONS))
      .describe('A plain reason, never the matched video or a threshold'),
    decision: z.enum(['rejected']).nullable().describe('Set once a moderator rejected the video'),
    decisionNote: z.string().nullable().describe('The reason the moderator gave'),
    canAppeal: z.boolean(),
    appeal: z
      .object({ message: z.string(), createdAt: z.string(), resolved: z.boolean() })
      .nullable(),
  })
  .meta({ id: 'CreatorScreening' });

export const getVideoScreening = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/screening',
  tag: 'Creator Studio',
  summary: 'Why a video is on hold',
  description:
    'The owner reads why the video is held or was rejected by screening, in plain terms, with whether it can be appealed.',
  params: VideoIdParamSchema,
  status: 200,
  result: CreatorScreeningSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const appealScreening = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/screening/appeal',
  tag: 'Creator Studio',
  summary: 'Appeal a screening rejection',
  description:
    'The owner appeals a rejection that screening led to, with a message. The video goes back on hold and into the moderation queue, where a different moderator decides. A takedown by a moderator cannot be appealed.',
  params: VideoIdParamSchema,
  body: z.object({
    message: z.string().trim().min(1).max(1000).describe('Why the rejection is a mistake'),
  }),
  status: 201,
  result: CreatorScreeningSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
  },
});

export type ScreeningCaseView = z.infer<typeof ScreeningCaseSchema>;
export type ScreeningFindingView = z.infer<typeof FindingSchema>;
export type ScreeningMatchedVideoView = z.infer<typeof MatchedVideoSchema>;
export type ScreeningDecisionView = z.infer<typeof ScreeningDecisionSchema>;
export type CreatorScreeningView = z.infer<typeof CreatorScreeningSchema>;
