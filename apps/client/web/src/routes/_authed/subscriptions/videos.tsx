import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  SubscriptionFeed,
  subscriptionFeedQueryOptions,
  VideoFeedSkeleton,
} from '#app/features/browse';

export const Route = createFileRoute('/_authed/subscriptions/videos')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.ensureInfiniteQueryData(subscriptionFeedQueryOptions(api)),
  pendingComponent: VideoFeedSkeleton,
  component: SubscriptionFeed,
});
