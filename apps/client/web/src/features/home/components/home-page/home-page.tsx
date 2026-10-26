import { useSuspenseQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Skeleton } from '@vp/ui';

import { VideoGridSkeleton } from '#app/features/browse/components/video-grid/video-grid';
import { homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomeShelf } from '../home-shelf/home-shelf';

export function HomePage() {
  const api = useApi();
  const { tOr } = useT();

  const { data } = useSuspenseQuery(homeQueryOptions(api));

  if (data.shelves.length === 0) {
    return <p className="tw:text-fg-muted">{tOr('home.empty', {}, '')}</p>;
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-8">
      {data.shelves.map((shelf) => (
        <HomeShelf key={`${shelf.kind}:${shelf.subject?.id ?? ''}`} shelf={shelf} />
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div aria-hidden="true" className="tw:flex tw:flex-col tw:gap-6">
      <Skeleton className="tw:h-6 tw:w-48" />
      <VideoGridSkeleton />
    </div>
  );
}
