import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { PageHeader, SectionError } from '@vp/components';
import { isExactChannelMatch } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Callout } from '@vp/ui';
import { useId, useRef } from 'react';

import { FeedSentinel } from '#app/features/browse/components/feed-sentinel/feed-sentinel';
import { useWindowRows } from '#app/hooks/use-window-rows';
import { searchQueryOptions } from '../api/search-queries';
import { matchedTerms } from '../matched-terms';
import { ChannelResultHeader } from './channel-result-header';
import { SearchNoResults } from './search-no-results';
import { SearchResult, searchResultKey } from './search-result';
import { SearchSortMenu } from './search-sort-menu';
import { SearchTypeChipBar } from './search-type-chip-bar';

const route = getRouteApi('/search');

const ESTIMATED_ROW_HEIGHT = 130;

export interface SearchResultsProps {
  query: string;
}

export function SearchResults({ query }: SearchResultsProps) {
  const api = useApi();
  const { type, sort } = route.useLoaderDeps();
  const { data, hasNextPage, isFetching, isError, fetchNextPage } = useSuspenseInfiniteQuery(
    searchQueryOptions(api, { query, type, sort })
  );
  const { tOr } = useT();
  const headingId = useId();
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
    <section className="flex flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1 id={headingId}>{tOr('search.resultsFor', { query }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <div className="flex items-center gap-stack">
        <SearchTypeChipBar counts={{ [type]: first?.total }} />
        <SearchSortMenu />
      </div>
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
    </section>
  );
}
