import {
  type InfiniteData,
  type QueryKey,
  type UseSuspenseInfiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useMemo } from 'react';

export type VideoPage = { items: VideoSummary[]; nextCursor: string | null };

export type VideoPagesOptions<
  TPage extends VideoPage,
  TKey extends QueryKey,
> = UseSuspenseInfiniteQueryOptions<TPage, Error, InfiniteData<TPage>, TKey, string | undefined>;

export function useVideoPages<TPage extends VideoPage, TKey extends QueryKey>(
  options: VideoPagesOptions<TPage, TKey>
) {
  const { data, hasNextPage, isFetching, isError, fetchNextPage, refetch } =
    useSuspenseInfiniteQuery(options);
  const videos = useMemo(() => data.pages.flatMap((page) => page.items), [data.pages]);

  return {
    videos,
    hasMore: hasNextPage,
    isFetching,
    isError,
    loadMore: () => fetchNextPage({ cancelRefetch: false }),
    retry: () => refetch(),
  };
}
