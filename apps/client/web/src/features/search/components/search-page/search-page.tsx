import { useT } from '@kit/intl-react';
import { Skeleton } from '@kit/ui';
import { getRouteApi } from '@tanstack/react-router';
import { ChipBarSkeleton } from '#app/components/discovery/chip-bar';
import { SearchResults, SearchResultsSkeleton } from '../search-results/search-results';

const route = getRouteApi('/search');

export function SearchPage() {
  const { query } = route.useLoaderDeps();
  const { tOr } = useT();

  if (query === undefined) {
    return <p>{tOr('search.noQuery', {}, '')}</p>;
  }

  return <SearchResults query={query} />;
}

export function SearchPageSkeleton() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <ChipBarSkeleton />
      <SearchResultsSkeleton />
    </section>
  );
}
