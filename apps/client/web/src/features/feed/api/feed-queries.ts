import { infiniteQueryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { FeedQuery } from '@vp/api-contracts';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export type PublicFeedFilter = Pick<FeedQuery, 'sort' | 'categoryId'>;

export const feedKeys = {
  all: ['feed'] as const,
  public: (filter: PublicFeedFilter) => [...feedKeys.all, 'public', filter] as const,
  subscriptions: () => [...feedKeys.all, 'subscriptions'] as const,
  shorts: () => [...feedKeys.all, 'shorts'] as const,
};

export function publicFeedQueryOptions(api: ApiClient, filter: PublicFeedFilter) {
  return infiniteQueryOptions({
    queryKey: feedKeys.public(filter),
    queryFn: ({ pageParam }) =>
      api.feed.getFeed({ query: { ...filter, limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function subscriptionFeedQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: feedKeys.subscriptions(),
    queryFn: ({ pageParam }) =>
      api.subscriptions.getSubscriptionFeed({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export function shortsFeedQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: feedKeys.shorts(),
    queryFn: ({ pageParam }) =>
      api.shorts.getShorts({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}
