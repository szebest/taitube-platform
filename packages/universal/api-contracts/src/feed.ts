import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';
import { CursorSchema, PageLimitSchema } from './pagination.js';
import { VideoSummarySchema } from './video-resource.js';

export const FEED_SORTS = ['recent', 'popular', 'trending'] as const;

export const FeedSortSchema = z
  .enum(FEED_SORTS)
  .default('recent')
  .describe('Feed sort mode: recent (newest), popular (views count), trending (gravity ranking)');

export const FeedResponseSchema = z.object({
  items: z.array(VideoSummarySchema).describe('Page of public video summary items'),
  nextCursor: z
    .string()
    .nullable()
    .describe('Opaque base64url keyset pagination cursor for next page'),
  total: z.number().int().nonnegative().describe('Total number of matching public ready videos'),
});

export const FeedQuerySchema = z.object({
  sort: FeedSortSchema,
  categoryId: z.string().uuid().optional().describe('Optional category UUID filter'),
  cursor: CursorSchema.optional(),
  limit: PageLimitSchema,
});

export const getFeed = defineEndpoint({
  method: 'GET',
  path: '/v1/feed',
  tag: 'Feed',
  summary: 'Public video feed',
  description:
    'Browse public ready videos with multi-sort (recent, popular, trending) and category filtering. Anonymous access permitted.',
  anonymous: true,
  query: FeedQuerySchema,
  status: 200,
  result: FeedResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type FeedSort = z.infer<typeof FeedSortSchema>;
export type FeedQuery = z.input<typeof FeedQuerySchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
