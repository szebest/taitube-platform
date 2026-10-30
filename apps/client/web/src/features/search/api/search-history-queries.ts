import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const RECENT_SEARCHES = 8;

export const searchHistoryKeys = {
  all: ['search-history'] as const,
  recent: () => [...searchHistoryKeys.all, 'recent'] as const,
};

export function recentSearchesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: searchHistoryKeys.recent(),
    queryFn: () => api.searchHistory.listSearchHistory({ query: { limit: RECENT_SEARCHES } }),
    staleTime: 0,
  });
}
