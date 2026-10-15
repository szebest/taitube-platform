import { infiniteQueryOptions } from '@tanstack/react-query';
import type { FeedQuery } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

import { apiClient } from '#app/integrations/api/api-client';

export type PublicFeedFilter = Pick<FeedQuery, 'sort' | 'categoryId'>;

export const feedKeys = {
  all: ['feed'] as const,
  public: (filter: PublicFeedFilter) => [...feedKeys.all, 'public', filter] as const,
  subscriptions: () => [...feedKeys.all, 'subscriptions'] as const,
};

export function publicFeedQueryOptions(filter: PublicFeedFilter) {
  return infiniteQueryOptions({
    queryKey: feedKeys.public(filter),
    queryFn: ({ pageParam }) =>
      apiClient.feed.getFeed({ query: { ...filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function subscriptionFeedQueryOptions() {
  return infiniteQueryOptions({
    queryKey: feedKeys.subscriptions(),
    queryFn: ({ pageParam }) =>
      apiClient.subscriptions.getSubscriptionFeed({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}
