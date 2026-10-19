import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { TrendingFeed } from '#app/features/browse/components/trending-feed/trending-feed';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';

export const Route = createFileRoute('/feed/trending')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.ensureInfiniteQueryData(publicFeedQueryOptions(api, { sort: 'trending' }));
  },
  pendingComponent: VideoFeedSkeleton,
  component: TrendingFeed,
});
