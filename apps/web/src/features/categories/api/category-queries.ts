import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

const CATEGORIES_STALE_TIME_MS = 5 * 60 * 1000;

const categoryKeys = {
  all: ['categories'] as const,
};

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: categoryKeys.all,
    queryFn: () => apiClient.categories.listCategories(),
    staleTime: CATEGORIES_STALE_TIME_MS,
  });
}
