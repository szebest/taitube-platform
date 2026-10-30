import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { adminPicksQueryOptions } from '#app/features/admin/api/admin-picks';

/** The picks scheduled for the next 30 days, earliest first. */
export function useAdminPicks() {
  return useQuery(adminPicksQueryOptions(useApi()));
}
