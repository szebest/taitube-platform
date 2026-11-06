import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { publicFeedQueryOptions } from '#app/features/browse/api/feed-queries';
import { TrendingFeed } from '#app/features/browse/components/trending-feed/trending-feed';
import { VideoFeedSkeleton } from '#app/features/browse/components/video-feed/video-feed';
import { WEB_URL } from '#app/lib/config';
import { feedHead } from '#app/lib/seo/feed-head';
import { headWords } from '#app/lib/seo/head-words';

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
