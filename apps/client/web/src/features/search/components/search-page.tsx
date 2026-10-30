import { getRouteApi } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Skeleton } from '@vp/ui';

import { ChipBarSkeleton } from '#app/components/discovery/chip-bar';
import { VideoCardSkeleton } from '#app/components/video/video-card';
import { SearchResults } from './search-results';

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
    <section aria-hidden="true" className="tw:flex tw:flex-col tw:gap-6">
      <Skeleton className="tw:h-7 tw:w-40" />
      <ChipBarSkeleton />
      <VideoCardSkeleton variant="row" count={6} />
    </section>
  );
}
