import { ANALYTICS_RANGES, HOURLY_WINDOW_HOURS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const ViewDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('UTC calendar day, YYYY-MM-DD');

const AnalyticsQuerySchema = z.object({
  range: z
    .enum(ANALYTICS_RANGES)
    .default('30d')
    .describe(
      'How many days back the timeline reaches, today included; lifetime reaches the first day with views'
    ),
});

const DailyViewsSchema = z.object({
  viewDate: ViewDateSchema,
  views: z.number().int().nonnegative().describe('Views counted that day'),
  watchSeconds: z.number().nonnegative().describe('Seconds watched by the views counted that day'),
});

const HourlyViewsSchema = z.object({
  viewHour: z.iso.datetime().describe('Start of the UTC hour'),
  views: z.number().int().nonnegative().describe('Views counted in that hour'),
});

const PeriodTotalsSchema = {
  rangeViews: z.number().int().nonnegative().describe('Views counted inside the range'),
  rangeWatchSeconds: z
    .number()
    .nonnegative()
    .describe('Seconds watched by the views counted inside the range'),
};

const RangeSchema = {
  range: z.enum(ANALYTICS_RANGES).describe('The range the timeline covers'),
  from: ViewDateSchema.describe(
    'First day of the range; for lifetime the first day with views, today when none'
  ),
  to: ViewDateSchema.describe('Last day of the range, today'),
  timeline: z.array(DailyViewsSchema).describe('One entry per day of the range, oldest first'),
  hourly: z
    .array(HourlyViewsSchema)
    .describe(
      `One entry per hour of the last ${HOURLY_WINDOW_HOURS} hours, the current one included, oldest first; independent of the range`
    ),
  ...PeriodTotalsSchema,
};

const VideoAnalyticsSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  totalViews: z.number().int().nonnegative().describe('Views counted since the video was made'),
  averageDailyViews: z.number().nonnegative().describe('Range views divided by the days in it'),
  averageRetention: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe('Share of the video the average view in the range watched; null with no views'),
  ...RangeSchema,
  previous: z
    .object(PeriodTotalsSchema)
    .nullable()
    .describe('The same totals over the period as long just before the range; null for lifetime'),
});

const TopVideoSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  title: z.string().describe('Video title'),
  views: z.number().int().nonnegative().describe('Views counted inside the range'),
  totalViews: z.number().int().nonnegative().describe('Views counted since the video was made'),
});

const ChannelAnalyticsSchema = z.object({
  totalViews: z.number().int().nonnegative().describe('Views of every video the caller owns'),
  videoCount: z.number().int().nonnegative().describe('Videos the caller owns'),
  dailyVelocity: z.number().nonnegative().describe('Range views divided by the days in it'),
  topVideos: z.array(TopVideoSchema).describe('The most viewed videos inside the range'),
  netSubscribers: z.number().int().describe('Subscribers gained minus lost inside the range'),
  ...RangeSchema,
  previous: z
    .object({
      ...PeriodTotalsSchema,
      netSubscribers: z.number().int().describe('Subscribers gained minus lost in that period'),
    })
    .nullable()
    .describe('The same totals over the period as long just before the range; null for lifetime'),
});

export const getVideoAnalytics = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/analytics',
  tag: 'Creator Analytics',
  summary: 'Views timeline and summary of one owned video',
  description:
    'Daily and hourly views, total views and average retention of a video the caller owns, with the previous period for comparison. Views reach it within one flush interval of being counted.',
  params: VideoIdParamSchema,
  query: AnalyticsQuerySchema,
  status: 200,
  result: VideoAnalyticsSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

const RetentionPointSchema = z.object({
  percent: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Position in the video, in steps of 5 percent'),
  viewers: z.number().int().nonnegative().describe('Viewers who reached that position'),
});

const VideoRetentionSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  curve: z.array(RetentionPointSchema).describe('One point per 5 percent, from 0 to 100'),
});

export const getVideoRetention = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/retention',
  tag: 'Creator Analytics',
  summary: 'Audience retention curve of one owned video',
  description:
    'How many viewers reached each 5 percent of a video the caller owns, revealing where they drop off. Playback beacons reach it within one flush interval.',
  params: VideoIdParamSchema,
  status: 200,
  result: VideoRetentionSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const getChannelAnalytics = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/channel/analytics',
  tag: 'Creator Analytics',
  summary: "Views across the caller's channel",
  description:
    'Aggregated daily and hourly views, total views, daily velocity, net subscribers and the top videos over every video the caller owns, with the previous period for comparison.',
  query: AnalyticsQuerySchema,
  status: 200,
  result: ChannelAnalyticsSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
  },
});

export type VideoAnalytics = z.infer<typeof VideoAnalyticsSchema>;
export type ChannelAnalytics = z.infer<typeof ChannelAnalyticsSchema>;
export type VideoRetention = z.infer<typeof VideoRetentionSchema>;
