import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const categoryKeys = {
  all: ['categories'] as const,
};

export function categoriesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => api.categories.listCategories({ signal }),
  });
}
