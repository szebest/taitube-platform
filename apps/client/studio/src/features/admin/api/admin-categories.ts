import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractResult, listAdminCategories } from '@vp/api-contracts';

export type AdminCategory = ContractResult<typeof listAdminCategories>[number];

export const adminCategoryKeys = {
  all: ['admin', 'categories'] as const,
};

export function adminCategoriesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: adminCategoryKeys.all,
    queryFn: () => api.adminCategories.listAdminCategories(),
  });
}
