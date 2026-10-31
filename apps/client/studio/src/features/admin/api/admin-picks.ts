import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ContractResult, listAdminPicks } from '@vp/api-contracts';

export type AdminPick = ContractResult<typeof listAdminPicks>['items'][number];

export const adminPickKeys = {
  all: ['admin', 'picks'] as const,
};

/** The picks touching the next 30 days, the range the API answers when it is given none. */
export function adminPicksQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: adminPickKeys.all,
    queryFn: async () => (await api.picks.listAdminPicks()).items,
  });
}
