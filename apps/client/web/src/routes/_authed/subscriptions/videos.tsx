import { createFileRoute } from '@tanstack/react-router';
import { readAuthToken } from '@vp/queries';
import { z } from 'zod';

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
