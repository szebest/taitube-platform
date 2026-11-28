import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { libraryKeys } from '#app/lib/query-keys/library-keys';

const CHANNEL_RESULTS = 8;

const pickerKeys = {
  channels: (query: string) => [...libraryKeys.all, 'channel-search', query] as const,
  categories: () => [...libraryKeys.all, 'categories'] as const,
};

/** Channels whose name or handle matches `query`, for a picker; never recorded as a search. */
export function channelSearchQueryOptions(api: ApiClient, query: string) {
  return queryOptions({
    queryKey: pickerKeys.channels(query),
    queryFn: async ({ signal }) => {
      const { items } = await api.search.search({
        query: { q: query, type: 'channel', limit: CHANNEL_RESULTS, record: 'false' },
        signal,
      });
      return items.flatMap((item) => (item.type === 'channel' ? [item.data] : []));
    },
    enabled: query.length > 0,
  });
}

export function categoriesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: pickerKeys.categories(),
    queryFn: () => api.categories.listCategories(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
