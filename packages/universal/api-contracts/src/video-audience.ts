import { BENCHMARK_PEER_LIMIT, FIRST_WEEK_DAYS, VIEW_DEVICES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

const AUDIENCE_RANGES = ['7d', '30d', '90d'] as const;

const AudienceQuerySchema = z.object({
  range: z
    .enum(AUDIENCE_RANGES)
    .default('30d')
    .describe('How many days back the split reaches, today included'),
});

const VideoAudienceSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  range: z.enum(AUDIENCE_RANGES).describe('The range the split covers'),
  from: z.iso.date().describe('First day of the range, UTC'),
  to: z.iso.date().describe('Last day of the range, today, UTC'),
  devices: z
    .array(
      z.object({
        device: z.enum(VIEW_DEVICES).describe('Device class the viewers reported'),
        views: z.number().int().nonnegative().describe('Views counted on that device class'),
        share: z.number().min(0).max(1).describe('Part of the counted views of the range'),
      })
    )
    .describe('One entry per device class with views, most viewed first'),
});

const NullableCount = z.number().nonnegative().nullable();

const BenchmarkDaySchema = z.object({
  day: z
    .number()
    .int()
    .min(0)
    .max(FIRST_WEEK_DAYS - 1)
    .describe('UTC days after the day the video became ready'),
  views: NullableCount.describe(
    'Cumulative views of the video by the end of that day; null for a day not begun yet'
  ),
  p25: NullableCount.describe('25th percentile of the earlier videos; null without an envelope'),
  median: NullableCount.describe('Median of the earlier videos; null without an envelope'),
  p75: NullableCount.describe('75th percentile of the earlier videos; null without an envelope'),
});

const VideoBenchmarkSchema = z.object({
  videoId: z.uuid().describe('Video UUID identifier'),
  publishedAt: z.iso
    .datetime()
    .nullable()
    .describe('When the video became ready; null while it has not'),
  peerCount: z
    .number()
    .int()
    .min(0)
    .max(BENCHMARK_PEER_LIMIT)
    .describe('Earlier public videos of the channel the envelope is taken over'),
  days: z.array(BenchmarkDaySchema).describe('One entry for each of the first seven UTC days'),
});

const ANALYTICS_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const getVideoAudience = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/audience',
  scope: 'analytics:read',
  tag: 'Creator Analytics',
  summary: 'Device split of the views of one owned video',
  description:
    'The counted views of a video the caller owns by the device class the player reported, most viewed first, each with its share of the range. A view without a reported device counts as unknown. Views reach it within one flush interval.',
  params: VideoIdParamSchema,
  query: AudienceQuerySchema,
  status: 200,
  result: VideoAudienceSchema,
  errors: ANALYTICS_ERRORS,
});

export const getVideoBenchmark = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/benchmark',
  scope: 'analytics:read',
  tag: 'Creator Analytics',
  summary: "First week of one owned video against the channel's earlier first weeks",
  description:
    'Cumulative views by the end of each of the first seven UTC days after the video became ready, with the 25th percentile, median and 75th percentile of the same series over the up to ten most recent public videos of the channel that are at least seven days old. The envelope is null while fewer than three such videos exist.',
  params: VideoIdParamSchema,
  status: 200,
  result: VideoBenchmarkSchema,
  errors: ANALYTICS_ERRORS,
});

export type VideoAudience = z.infer<typeof VideoAudienceSchema>;
export type VideoBenchmark = z.infer<typeof VideoBenchmarkSchema>;
