import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelMembershipView } from '@vp/api-contracts';

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

/** The channels the caller works on as the permission rules read them: by channel id, with the owner and the role held. */
export function membershipGrantsOf(items: readonly ChannelMembershipView[]) {
  return Object.fromEntries(
    items.map(({ channelId, ownerId, role }) => [channelId, { ownerId, role }])
  );
}
