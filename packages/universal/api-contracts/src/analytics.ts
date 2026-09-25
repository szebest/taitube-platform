import { ANALYTICS_RANGES } from '@vp/domain';
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
    .describe('How many days back the timeline reaches, today included'),
});

const DailyViewsSchema = z.object({
  viewDate: ViewDateSchema,
  views: z.number().int().nonnegative().describe('Views counted that day'),
  watchSeconds: z.number().nonnegative().describe('Seconds watched by the views counted that day'),
});

const RangeSchema = {
  range: z.enum(ANALYTICS_RANGES).describe('The range the timeline covers'),
  from: ViewDateSchema.describe('First day of the range'),
  to: ViewDateSchema.describe('Last day of the range, today'),
  timeline: z.array(DailyViewsSchema).describe('One entry per day of the range, oldest first'),
  rangeViews: z.number().int().nonnegative().describe('Views counted inside the range'),
};

const VideoAnalyticsSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  totalViews: z.number().int().nonnegative().describe('Views counted since the video was made'),
  averageDailyViews: z.number().nonnegative().describe('Range views divided by the days in it'),
  averageRetention: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe('Share of the video the average view in the range watched; null with no views'),
  ...RangeSchema,
});

const TopVideoSchema = z.object({
  videoId: z.string().uuid().describe('Video UUID identifier'),
  title: z.string().describe('Video title'),
  views: z.number().int().nonnegative().describe('Views counted inside the range'),
  totalViews: z.number().int().nonnegative().describe('Views counted since the video was made'),
});

const ChannelAnalyticsSchema = z.object({
  totalViews: z.number().int().nonnegative().describe('Views of every video the caller owns'),
  videoCount: z.number().int().nonnegative().describe('Videos the caller owns'),
  dailyVelocity: z.number().nonnegative().describe('Range views divided by the days in it'),
  topVideos: z.array(TopVideoSchema).describe('The most viewed videos inside the range'),
  ...RangeSchema,
});

export const getVideoAnalytics = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/analytics',
  tag: 'Creator Analytics',
  summary: 'Views timeline and summary of one owned video',
  description:
    'Daily views, total views and average retention of a video the caller owns. Views reach it within one flush interval of being counted.',
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

export const getChannelAnalytics = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/channel/analytics',
  tag: 'Creator Analytics',
  summary: "Views across the caller's channel",
  description:
    'Aggregated daily views, total views, daily velocity and the top videos over every video the caller owns.',
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
