import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { adminCategoriesQueryOptions } from '#app/features/admin/api/admin-categories';

/** Every category, active and inactive, with its video count. */
export function useAdminCategories() {
  return useQuery(adminCategoriesQueryOptions(useApi()));
}
