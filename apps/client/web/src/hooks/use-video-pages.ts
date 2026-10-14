import {
  type InfiniteData,
  type QueryKey,
  type UseSuspenseInfiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useMemo } from 'react';

type VideoPage = { items: VideoSummary[]; nextCursor: string | null };

type Cursor = string | undefined;

export function useVideoPages<TPage extends VideoPage, TKey extends QueryKey>(
  options: UseSuspenseInfiniteQueryOptions<TPage, Error, InfiniteData<TPage>, TKey, Cursor>
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
