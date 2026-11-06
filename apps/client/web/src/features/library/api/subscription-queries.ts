import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  mine: () => [...subscriptionKeys.all, 'mine'] as const,
  status: (channelId: string) => [...subscriptionKeys.all, 'status', channelId] as const,
};

export function mySubscriptionsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: subscriptionKeys.mine(),
    queryFn: () => api.subscriptions.listMySubscriptions({ query: {} }),
  });
}

export function subscriptionStatusQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: subscriptionKeys.status(channelId),
    queryFn: () => api.subscriptions.isSubscribedToChannel({ params: { id: channelId } }),
  });
}
