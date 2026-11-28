import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

/** The categories the filter offers: the current video's category is what a room is filtered by. */
export function partyCategoriesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: ['watch-parties', 'categories'] as const,
    queryFn: () => api.categories.listCategories(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
