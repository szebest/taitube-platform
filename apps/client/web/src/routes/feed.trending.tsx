import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { TrendingFeed } from '#app/features/browse/components/trending-feed/trending-feed';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';
import { WEB_URL } from '#app/config';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { feedHead } from '#app/features/seo/feed-head';
import { headWords } from '#app/features/seo/head-words';

export const Route = createFileRoute('/feed/trending')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    const feed = await queryClient.ensureInfiniteQueryData(
      publicFeedQueryOptions(api, { sort: 'trending' })
    );
    return feed.pages[0]?.items ?? [];
  },
  head: ({ loaderData, match }) => {
    const { locale, tOr } = headWords(match.context.locales.snapshot());
    return feedHead({
      path: '/feed/trending',
      title: tOr('shell.trending', {}, ''),
      description: tOr('shell.trendingDescription', {}, ''),
      videos: loaderData ?? [],
      siteUrl: WEB_URL,
      locale,
    });
  },
  pendingComponent: VideoFeedSkeleton,
  component: TrendingFeed,
});
