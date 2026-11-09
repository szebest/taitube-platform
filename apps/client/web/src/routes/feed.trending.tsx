import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TrendingFeed, VideoFeedSkeleton } from '#app/features/browse';
import { WEB_URL } from '#app/lib/config';
import { publicFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
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
