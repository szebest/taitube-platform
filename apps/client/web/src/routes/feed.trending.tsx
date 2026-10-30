import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { TrendingFeed } from '#app/features/browse/components/trending-feed/trending-feed';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';
import { WEB_URL } from '#app/config';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { feedHead } from '#app/features/seo/feed-head';

export const Route = createFileRoute('/feed/trending')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    const feed = await queryClient.ensureInfiniteQueryData(
      publicFeedQueryOptions(api, { sort: 'trending' })
    );
    return feed.pages[0]?.items ?? [];
  },
  head: ({ loaderData }) =>
    feedHead({
      path: '/feed/trending',
      title: 'Trending',
      description: 'The videos people are watching on Taitube right now.',
      videos: loaderData ?? [],
      siteUrl: WEB_URL,
    }),
  pendingComponent: VideoFeedSkeleton,
  component: TrendingFeed,
});
