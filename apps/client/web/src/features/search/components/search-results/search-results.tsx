import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { PageHeader, SectionError, VideoCardSkeleton } from '@vp/components';
import { isExactChannelMatch } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Callout } from '@vp/ui';
import { Suspense, useId, useRef } from 'react';
import { FeedSentinel } from '#app/components/feed/feed-sentinel';
import { searchQueryOptions } from '#app/features/search/api/search-queries';
import { matchedTerms } from '#app/features/search/utils/matched-terms';
import { useWindowRows } from '#app/hooks/use-window-rows';
import { ChannelResultHeader } from '../channel-result-header/channel-result-header';
import { SearchNoResults } from '../search-no-results/search-no-results';
import { SearchResult, searchResultKey } from '../search-result/search-result';
import { SearchSortMenu } from '../search-sort-menu/search-sort-menu';
import { SearchTypeChipBar } from '../search-type-chip-bar/search-type-chip-bar';

const route = getRouteApi('/search');

const ESTIMATED_ROW_HEIGHT = 130;

export interface SearchResultsProps {
  query: string;
}

/** The heading, the type tabs and the sort stay mounted while a tab or a sort loads; only the results under them wait. */
export function SearchResults({ query }: SearchResultsProps) {
  const { type, sort } = route.useLoaderDeps();
  const { tOr } = useT();
  const headingId = useId();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1 id={headingId}>{tOr('search.resultsFor', { query }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <div className="flex min-w-0 items-center gap-stack">
        <SearchTypeChipBar query={query} />
        <SearchSortMenu />
      </div>
      <Suspense key={`${type}:${sort}`} fallback={<SearchResultsSkeleton />}>
        <SearchResultList query={query} headingId={headingId} />
      </Suspense>
    </section>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div aria-hidden="true">
      <VideoCardSkeleton variant="row" count={6} />
    </div>
  );
}

interface SearchResultListProps extends SearchResultsProps {
  headingId: string;
}

function SearchResultList({ query, headingId }: SearchResultListProps) {
  const api = useApi();
  const { type, sort } = route.useLoaderDeps();
  const { data, hasNextPage, isFetching, isError, fetchNextPage } = useSuspenseInfiniteQuery(
    searchQueryOptions(api, { query, type, sort })
  );
  const { tOr } = useT();
  const list = useRef<HTMLUListElement>(null);

  const [first] = data.pages;
  const items = data.pages.flatMap((page) => page.items);
  const terms = matchedTerms(query);
  const [lead] = items;
  const spotlight =
    type === 'all' && lead?.type === 'channel' && isExactChannelMatch(lead.data, query)
      ? lead.data
      : undefined;
  const listed = spotlight === undefined ? items : items.slice(1);
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: listed.length,
    estimateRowHeight: ESTIMATED_ROW_HEIGHT,
    getRowKey: (row) => (listed[row] ? searchResultKey(listed[row]) : String(row)),
  });

  return (
    <div className="flex animate-fade-in flex-col gap-6">
      {first?.fuzzyFallback && (
        <Callout.Root role="status">
          <Callout.Icon />
          <Callout.Title>{tOr('search.fuzzyTitle', { query }, '')}</Callout.Title>
          <Callout.Body>{tOr('search.fuzzyBody', {}, '')}</Callout.Body>
        </Callout.Root>
      )}
      {items.length === 0 && <SearchNoResults query={query} />}
      {spotlight && (
        <div className="rounded-card bg-raised p-inset-card">
          <ChannelResultHeader channel={spotlight} terms={terms} />
        </div>
      )}
      {listed.length > 0 && (
        <ul
          ref={list}
          aria-labelledby={headingId}
          className="m-0 flex list-none flex-col gap-6 p-0"
          style={padding}
        >
          {rows.map(({ index, key }) => {
            const result = listed[index];

            return (
              result && (
                <li key={key} ref={measureRow} data-index={index}>
                  <SearchResult result={result} terms={terms} />
                </li>
              )
            );
          })}
        </ul>
      )}
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={() => fetchNextPage()}>
          <SectionError.Message>{tOr('browse.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {hasNextPage && !isFetching && !isError && (
        <FeedSentinel onNear={() => fetchNextPage({ cancelRefetch: false })} />
      )}
    </div>
  );
}
