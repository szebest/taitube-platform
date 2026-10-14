import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { readAuthToken } from '#app/auth-token';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { SubscriptionVideosPage } from '#app/modules/SubscriptionVideos';

export const Route = createFileRoute('/_authed/subscriptions/videos')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient } }) => {
    if (readAuthToken() === null) return;
    await queryClient.ensureInfiniteQueryData(subscriptionFeedQueryOptions());
  },
  component: SubscriptionVideosPage,
});
