import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const SearchHistoryItemSchema = z.object({
  id: z.uuid(),
  query: z.string().describe('The text as the caller last typed it, tidied'),
  searchedAt: z.string().describe('ISO 8601 timestamp of the last time it was searched'),
});

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
} as const;

export const listSearchHistory = defineEndpoint({
  method: 'GET',
  path: '/v1/me/searches',
  tag: 'Search history',
  summary: 'List my recent searches',
  description:
    'One entry per distinct query, newest first, keyset-paginated on (searched_at, id). Searching the same text again moves its entry to the top. The newest 100 are kept for at most 90 days, and nothing is recorded while privacy.historyPaused is set.',
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(SearchHistoryItemSchema), nextCursor: z.string().nullable() }),
  errors: { ...AUTHENTICATED, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const removeSearchHistoryEntry = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/searches/:id',
  tag: 'Search history',
  summary: 'Remove a search from my history',
  description: 'Answers 404 for an entry that is not the caller own.',
  params: z.object({ id: z.uuid() }),
  status: 204,
  result: z.null().describe('Entry removed'),
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.SEARCH_HISTORY_NOT_FOUND] },
});

export const clearSearchHistory = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/searches',
  tag: 'Search history',
  summary: 'Clear my search history',
  description: 'Removes every entry of the caller.',
  status: 204,
  result: z.null().describe('History cleared'),
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});

export type SearchHistoryItemView = z.infer<typeof SearchHistoryItemSchema>;
