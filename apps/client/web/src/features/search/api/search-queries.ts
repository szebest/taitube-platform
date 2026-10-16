import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export const searchKeys = {
  all: ['search'] as const,
  videos: (query: string) => [...searchKeys.all, 'videos', query] as const,
};

export function videoSearchQueryOptions(api: ApiClient, query: string) {
  return infiniteQueryOptions({
    queryKey: searchKeys.videos(query),
    queryFn: ({ pageParam }) =>
      api.search.search({
        query: { q: query, type: 'video', limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
