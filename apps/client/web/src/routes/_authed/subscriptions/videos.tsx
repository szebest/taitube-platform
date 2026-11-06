import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { subscriptionFeedQueryOptions } from '#app/features/browse/api/feed-queries';
import { SubscriptionFeed } from '#app/features/browse/components/subscription-feed/subscription-feed';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';

export const Route = createFileRoute('/_authed/subscriptions/videos')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureInfiniteQueryData(subscriptionFeedQueryOptions(api)),
  pendingComponent: VideoFeedSkeleton,
  component: SubscriptionFeed,
});
