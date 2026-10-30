import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractQuery, ContractResult, listAdminVideos } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export type AdminVideo = ContractResult<typeof listAdminVideos>['items'][number];
export type AdminVideoFilters = Omit<ContractQuery<typeof listAdminVideos>, 'cursor' | 'limit'>;

export const adminVideoKeys = {
  all: ['admin', 'videos'] as const,
  list: (filters: AdminVideoFilters) => [...adminVideoKeys.all, filters] as const,
};

/** Every owner's videos, keyset-paged, for the filters and sort the moderation page holds in its URL. */
export function adminVideosQueryOptions(api: ApiClient, filters: AdminVideoFilters) {
  return infiniteQueryOptions({
    queryKey: adminVideoKeys.list(filters),
    queryFn: ({ pageParam }) =>
      api.adminVideos.listAdminVideos({
        query: { ...filters, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
