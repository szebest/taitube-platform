import {
  EXPERIMENT_KINDS,
  EXPERIMENT_MIN_IMPRESSIONS,
  EXPERIMENT_STATUSES,
  EXPERIMENT_VARIANT_IDS,
  MAX_EXPERIMENT_VARIANTS,
  MAX_RUNNING_EXPERIMENTS_PER_CHANNEL,
  MIN_EXPERIMENT_VARIANTS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema, VideoSchema } from './video-resource';

/**
 * The ephemeral key a browser tab sends so its experiments pick one variant per session. Never a
 * cookie and never stored server side; without it the API answers the control.
 */
export const VIEWER_SESSION_HEADER = 'x-viewer-session';

const ExperimentVariantIdSchema = z.enum(EXPERIMENT_VARIANT_IDS);

const ThumbnailChoiceSchema = z.object({ source: z.literal('poster') });

const ExperimentVariantSchema = z.object({
  id: ExperimentVariantIdSchema.describe('a is the control'),
  title: z.string().nullable(),
  thumbnail: ThumbnailChoiceSchema.nullable(),
});

const VariantResultSchema = z.object({
  variantId: ExperimentVariantIdSchema,
  impressions: z.number().int().nonnegative(),
  starts: z.number().int().nonnegative(),
  watchSeconds: z.number().int().nonnegative(),
  watchSecondsPerImpression: z.number().nonnegative().nullable(),
  clickThrough: z.number().nonnegative().nullable(),
  averageViewSeconds: z.number().nonnegative().nullable(),
});

const ExperimentSchema = z.object({
  id: z.uuid(),
  videoId: z.uuid(),
  kind: z.enum(EXPERIMENT_KINDS),
  variants: z.array(ExperimentVariantSchema),
  status: z.enum(EXPERIMENT_STATUSES),
  startedAt: z.string().describe('ISO 8601'),
  endedAt: z.string().nullable().describe('ISO 8601; null while running'),
  winnerVariantId: ExperimentVariantIdSchema.nullable().describe('Set by Apply, never on its own'),
  results: z
    .object({
      enoughData: z
        .boolean()
        .describe(`false until every variant has ${EXPERIMENT_MIN_IMPRESSIONS} impressions`),
      variants: z.array(VariantResultSchema),
    })
    .describe('Every ratio is null while enoughData is false'),
});

const ExperimentParamsSchema = VideoIdParamSchema.extend({ experimentId: z.uuid() });

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const listVideoExperiments = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/experiments',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'List the title and thumbnail tests of a video',
  description:
    'Newest first, each with watch seconds per impression, click-through and view duration per variant.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(ExperimentSchema) }),
  errors: AUTHENTICATED,
});

export const createVideoExperiment = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/experiments',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Start a title or thumbnail test',
  description: `${MIN_EXPERIMENT_VARIANTS} or ${MAX_EXPERIMENT_VARIANTS} variants, the first the control. One running test per video and ${MAX_RUNNING_EXPERIMENTS_PER_CHANNEL} per channel. A thumbnail test needs two thumbnails of the video. oEmbed, OpenGraph and the sitemap keep the control.`,
  params: VideoIdParamSchema,
  body: z.object({
    kind: z.enum(EXPERIMENT_KINDS),
    variants: z.array(
      z.object({
        title: z.string().optional(),
        thumbnail: ThumbnailChoiceSchema.optional(),
      })
    ),
  }),
  status: 201,
  result: ExperimentSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.EXPERIMENT_LIMIT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const stopVideoExperiment = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/experiments/:experimentId/stop',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Stop a test without a winner',
  description:
    'Every viewer sees the current title and thumbnail again; the numbers so far are kept.',
  params: ExperimentParamsSchema,
  status: 200,
  result: ExperimentSchema,
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.EXPERIMENT_NOT_FOUND],
    409: [ErrorCodes.EXPERIMENT_NOT_RUNNING],
  },
});

export const applyVideoExperiment = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/experiments/:experimentId/apply',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Apply the winner of a test',
  description:
    'The creator picks the winner: it is written through the normal edit under the given version, so a stale version is 409 VERSION_CONFLICT, and the test finishes. Nothing is applied automatically.',
  params: ExperimentParamsSchema,
  body: z.object({
    variantId: ExperimentVariantIdSchema,
    version: z.number().int().nonnegative().describe('The video version the choice was made on'),
  }),
  status: 200,
  result: VideoSchema,
  errors: {
    ...AUTHENTICATED,
    404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.EXPERIMENT_NOT_FOUND],
    409: [ErrorCodes.EXPERIMENT_NOT_RUNNING, ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type ExperimentView = z.infer<typeof ExperimentSchema>;
