import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { isErr } from '@vp/result';

import { videoSearchQueryOptions } from '../api/search-queries';

const route = getRouteApi('/search');

export function SearchPage() {
  const query = route.useLoaderData();
  const { tOr } = useT();

  if (isErr(query)) {
    return <p>{tOr('search.noQuery', {}, '')}</p>;
  }

  return <SearchResults query={query.value} />;
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
      <h1 className="tw:text-lg tw:font-medium">{tOr('search.resultsFor', { query }, '')}</h1>
      <ul className="tw:flex tw:flex-col tw:gap-2">
        {videos.map((video) => (
          <li key={video.id}>
            <Link to="/watch/$videoId" params={{ videoId: video.id }}>
              {video.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
