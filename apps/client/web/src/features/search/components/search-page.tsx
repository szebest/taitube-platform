import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { VideoGrid } from '#app/features/browse/components/video-grid/video-grid';
import { videoSearchQueryOptions } from '../api/search-queries';

const route = getRouteApi('/search');

export function SearchPage() {
  const { query } = route.useLoaderDeps();
  const { tOr } = useT();

  if (query === undefined) {
    return <p>{tOr('search.noQuery', {}, '')}</p>;
  }

  return <SearchResults query={query} />;
}

function SearchResults({ query }: { query: string }) {
  const api = useApi();
  const { data } = useSuspenseInfiniteQuery(videoSearchQueryOptions(api, query));
  const { tOr } = useT();

  const videos = data.pages
    .flatMap((page) => page.items)
    .flatMap((hit) => (hit.type === 'video' ? [hit.data] : []));

  if (videos.length === 0) {
    return <p>{tOr('search.noResults', { query }, '')}</p>;
  }

  return (
    <section className="tw:flex tw:flex-col tw:gap-3">
      <h1 className="tw:text-title-lg">{tOr('search.resultsFor', { query }, '')}</h1>
      <VideoGrid videos={videos} />
    </section>
  );
}
