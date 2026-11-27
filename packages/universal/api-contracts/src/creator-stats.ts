import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const NonNegativeInt = z.number().int().nonnegative();

const CreatorStatsSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  generatedAt: z.iso.datetime().describe('When the numbers were read'),
  lifetime: z.object({
    views: NonNegativeInt.describe('Views counted since the video was made'),
    watchSeconds: z.number().nonnegative().describe('Seconds watched since the video was made'),
    likes: NonNegativeInt,
    comments: NonNegativeInt,
    subscribersGained: NonNegativeInt.describe(
      'Subscriptions made from this video that still stand: a net count'
    ),
  }),
  last30Days: z.object({
    views: NonNegativeInt,
    watchSeconds: z.number().nonnegative(),
    averageViewDurationSeconds: z
      .number()
      .nonnegative()
      .describe('Seconds watched over views in the 30 days; zero with no views'),
    daily: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), views: NonNegativeInt }))
      .describe('One entry per UTC day of the 30 days, today included, oldest first'),
  }),
  first48Hours: z
    .object({
      hours: z
        .array(z.object({ hour: z.iso.datetime(), views: NonNegativeInt }))
        .describe('One entry per hour from the hour the video became ready, oldest first'),
      windowEndsAt: z.iso.datetime().describe('When the first 48 hours end'),
    })
    .nullable()
    .describe('Null once the window has closed, or while the video is not ready'),
  retention: z.object({
    average: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .describe('Share of the video the average view watched; null with no views or no duration'),
    dropOffs: z
      .array(
        z.object({
          percent: z.number().int().min(0).max(100).describe('Where the bucket starts, in percent'),
          positionSeconds: NonNegativeInt.describe('Where the bucket starts, in seconds'),
          lostShare: z.number().min(0).max(1).describe('Share of the viewers who began lost there'),
        })
      )
      .describe('The largest drops after the first step, largest first; at most three'),
  }),
});

export const getCreatorStats = defineEndpoint({
  method: 'GET',
  path: '/v1/videos/:id/creator-stats',
  tag: 'Creator Analytics',
  summary: 'The numbers shown to the channel team on a video page',
  description:
    'Lifetime and 30 day totals, the first 48 hours by hour and the retention drop-offs of one video, in one request, for the owner and the team members whose role reads analytics. Never cached: `Cache-Control: private, no-store`.',
  params: VideoIdParamSchema,
  status: 200,
  result: CreatorStatsSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export type CreatorStats = z.infer<typeof CreatorStatsSchema>;
