import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const membershipKeys = {
  all: ['team', 'memberships'] as const,
};

/** The channels the caller works on besides their own, for the switcher and the permission rules. */
export function membershipsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: membershipKeys.all,
    queryFn: () => api.channelTeam.listMyMemberships(),
    staleTime: 30_000,
  });
}
