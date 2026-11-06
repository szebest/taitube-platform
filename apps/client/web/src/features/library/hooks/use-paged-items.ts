import {
  type InfiniteData,
  type QueryKey,
  type UseSuspenseInfiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import type { Page } from '../api/paged-list';

export type PagedItemsOptions<
  TPage extends Page<unknown>,
  TKey extends QueryKey,
> = UseSuspenseInfiniteQueryOptions<TPage, Error, InfiniteData<TPage>, TKey, string | undefined>;

/** Every loaded row of a keyset list, in order, and what its footer needs to load the next page. */
export function usePagedItems<TPage extends Page<unknown>, TKey extends QueryKey>(
  options: PagedItemsOptions<TPage, TKey>
) {
  const { data, hasNextPage, isFetching, isError, fetchNextPage } =
    useSuspenseInfiniteQuery(options);
  const items = data.pages.flatMap<TPage['items'][number]>((page) => page.items);

  return {
    items,
    hasMore: hasNextPage,
    isFetching,
    isError,
    loadMore: () => fetchNextPage({ cancelRefetch: false }),
  };
}
