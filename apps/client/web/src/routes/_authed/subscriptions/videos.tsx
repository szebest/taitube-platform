import { createFileRoute } from '@tanstack/react-router';
import { accountOf, communityFeedQueryOptions, postViewerKey } from '@vp/queries';
import {
  SubscriptionFeed,
  SubscriptionSearchSchema,
  VideoFeedSkeleton,
} from '#app/features/browse';
import { subscriptionFeedQueryOptions } from '#app/lib/query-keys/feed-keys';

export const Route = createFileRoute('/_authed/subscriptions/videos')({
  validateSearch: SubscriptionSearchSchema,
  loaderDeps: ({ search: { tab } }) => ({ tab }),
  loader: ({ context: { queryClient, api, auth }, deps: { tab } }) =>
    tab === 'community'
      ? queryClient.infiniteQuery({
          ...communityFeedQueryOptions(api, postViewerKey(accountOf(auth), auth.actingChannelId)),
          staleTime: 'static',
        })
      : queryClient.infiniteQuery({ ...subscriptionFeedQueryOptions(api), staleTime: 'static' }),
  pendingComponent: VideoFeedSkeleton,
  component: SubscriptionFeed,
});
