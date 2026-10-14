import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  mine: () => [...subscriptionKeys.all, 'mine'] as const,
  status: (channelId: string) => [...subscriptionKeys.all, 'status', channelId] as const,
};

export function mySubscriptionsQueryOptions() {
  return queryOptions({
    queryKey: subscriptionKeys.mine(),
    queryFn: () => apiClient.subscriptions.listMySubscriptions({ query: {} }),
  });
}

export function subscriptionStatusQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: subscriptionKeys.status(channelId),
    queryFn: () => apiClient.subscriptions.isSubscribedToChannel({ params: { id: channelId } }),
  });
}
