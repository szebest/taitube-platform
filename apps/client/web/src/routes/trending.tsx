import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { TrendingPage } from '#app/modules/Trending';

export const Route = createFileRoute('/trending')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.ensureInfiniteQueryData(publicFeedQueryOptions(api, { sort: 'trending' }));
  },
  component: TrendingPage,
});
