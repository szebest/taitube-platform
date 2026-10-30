import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { SearchSort, SearchType } from '@vp/domain';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

const PALETTE_RESULTS = 5;

export const searchKeys = {
  all: ['search'] as const,
  results: (query: string, type: SearchType, sort: SearchSort) =>
    [...searchKeys.all, 'results', query, type, sort] as const,
  preview: (query: string) => [...searchKeys.all, 'preview', query] as const,
  suggestions: (query: string) => [...searchKeys.all, 'suggestions', query] as const,
  topics: () => [...searchKeys.all, 'topics'] as const,
};

export interface SearchParams {
  query: string;
  type: SearchType;
  sort: SearchSort;
}

export function searchQueryOptions(api: ApiClient, { query, type, sort }: SearchParams) {
  return infiniteQueryOptions({
    queryKey: searchKeys.results(query, type, sort),
    queryFn: ({ pageParam }) =>
      api.search.search({
        query: { q: query, type, sort, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The first few hits of every kind, for the palette. */
export function palettePreviewQueryOptions(api: ApiClient, query: string) {
  return queryOptions({
    queryKey: searchKeys.preview(query),
    queryFn: ({ signal }) =>
      api.search.search({ query: { q: query, type: 'all', limit: PALETTE_RESULTS }, signal }),
  });
}

export function searchSuggestionsQueryOptions(api: ApiClient, query: string) {
  return queryOptions({
    queryKey: searchKeys.suggestions(query),
    queryFn: ({ signal }) => api.search.searchSuggestions({ query: { q: query }, signal }),
  });
}

/** Where a search with no hits can start from. */
export function topicsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: searchKeys.topics(),
    queryFn: () => api.categories.listCategories(),
  });
}
