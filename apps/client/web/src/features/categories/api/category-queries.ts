import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const CATEGORIES_STALE_TIME_MS = 5 * 60 * 1000;

const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};

export function categoriesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: () => api.categories.listCategories(),
    staleTime: CATEGORIES_STALE_TIME_MS,
  });
}
