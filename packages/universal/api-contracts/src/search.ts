import { SEARCH_PAGE_SIZE_MAX, SEARCH_SORTS, SEARCH_TYPES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { PAGE_SIZE_DEFAULT } from '@vp/pagination';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { CursorSchema } from './pagination';
import { ChannelCardSchema } from './playlists';
import { VideoSummarySchema } from './video-resource';

const QueryTextSchema = z
  .string()
  .describe(
    '1-100 characters after trimming, read as a web search: "a quoted phrase", or, and -excluded words'
  );

const SearchQuerySchema = z.object({
  q: QueryTextSchema,
  type: z
    .enum(SEARCH_TYPES)
    .default('all')
    .describe('Which kinds to search; all mixes channels, videos and playlists in one ranking'),
  categoryId: z.string().uuid().optional().describe('Narrows videos only'),
  sort: z
    .enum(SEARCH_SORTS)
    .default('relevance')
    .describe(
      'relevance blends the text match with popularity; date is newest first; views is the audience (views, subscribers, or the views of a playlist)'
    ),
  cursor: CursorSchema.optional().describe('Bound to the sort it was minted under'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_PAGE_SIZE_MAX)
    .default(PAGE_SIZE_DEFAULT)
    .describe(`Page size, 1-${SEARCH_PAGE_SIZE_MAX}`),
});

const ChannelSummarySchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  subscriberCount: z.number().int().nonnegative(),
});

const PlaylistSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().nullable().describe('The custom thumbnail, else the first video poster'),
  videoCount: z.number().int().nonnegative().describe('Videos an anonymous viewer may watch'),
  owner: ChannelCardSchema.nullable(),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 timestamp of the last change'),
});

const SearchResultItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('video'), data: VideoSummarySchema }),
  z.object({ type: z.literal('channel'), data: ChannelSummarySchema }),
  z.object({ type: z.literal('playlist'), data: PlaylistSummarySchema }),
]);

const SearchResponseSchema = z.object({
  items: z.array(SearchResultItemSchema),
  nextCursor: z.string().nullable(),
  tookMs: z.number().nonnegative().describe('Time the page took to produce, cache hits included'),
  total: z.number().int().nonnegative().describe('Every match across the kinds searched'),
  fuzzyFallback: z
    .boolean()
    .describe('Nothing matched the words as typed, so these are trigram matches for a likely typo'),
});

const SearchSuggestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('query'), text: z.string() }),
  z.object({
    type: z.literal('channel'),
    text: z.string().describe('The channel display name'),
    channelId: z.string().uuid(),
    handle: z.string(),
    avatarUrl: z.string().nullable(),
  }),
]);

const SEARCH_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
  422: [ErrorCodes.VALIDATION_FAILED],
} as const;

export const search = defineEndpoint({
  method: 'GET',
  path: '/v1/search',
  tag: 'Search',
  summary: 'Search videos, channels and playlists',
  description:
    'One ranking over public ready videos, channels and public playlists. A channel named exactly by the query is pinned first. When the words match nothing, trigram matches stand in and fuzzyFallback is true. Cached for 120 s; X-Cache says HIT or MISS.',
  anonymous: true,
  query: SearchQuerySchema,
  status: 200,
  result: SearchResponseSchema,
  errors: SEARCH_ERRORS,
});

export const searchSuggestions = defineEndpoint({
  method: 'GET',
  path: '/v1/search/suggestions',
  tag: 'Search',
  summary: 'Autocomplete a search',
  description:
    'Up to 10 completions: channels whose handle or name starts with the text first, then the most searched queries that start with it.',
  anonymous: true,
  query: z.object({ q: QueryTextSchema }),
  status: 200,
  result: z.object({ items: z.array(SearchSuggestionSchema) }),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 422: [ErrorCodes.VALIDATION_FAILED] },
});

export type SearchRequest = z.input<typeof SearchQuerySchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchSuggestion = z.infer<typeof SearchSuggestionSchema>;
export type SearchSuggestionsResponse = z.infer<typeof searchSuggestions.result>;
