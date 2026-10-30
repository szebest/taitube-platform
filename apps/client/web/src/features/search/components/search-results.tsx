import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { SectionError, PageHeader } from '@vp/components';
import { isExactChannelMatch } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Callout } from '@vp/ui';
import { useId } from 'react';

import { FeedSentinel } from '#app/features/browse/components/feed-sentinel/feed-sentinel';
import { searchQueryOptions } from '../api/search-queries';
import { matchedTerms } from '../matched-terms';
import { ChannelResultHeader } from './channel-result-header';
import { SearchNoResults } from './search-no-results';
import { SearchResult, searchResultKey } from './search-result';
import { SearchSortMenu } from './search-sort-menu';
import { SearchTypeChipBar } from './search-type-chip-bar';

const route = getRouteApi('/search');

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

  const [first] = data.pages;
  const items = data.pages.flatMap((page) => page.items);
  const terms = matchedTerms(query);
  const [lead] = items;
  const spotlight =
    type === 'all' && lead?.type === 'channel' && isExactChannelMatch(lead.data, query)
      ? lead.data
      : undefined;
  const listed = spotlight === undefined ? items : items.slice(1);

  return (
    <section className="tw:flex tw:flex-col tw:gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1 id={headingId}>{tOr('search.resultsFor', { query }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <div className="tw:flex tw:items-center tw:gap-stack">
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
        <div className="tw:rounded-card tw:bg-raised tw:p-inset-card">
          <ChannelResultHeader channel={spotlight} terms={terms} />
        </div>
      )}
      {listed.length > 0 && (
        <ul
          aria-labelledby={headingId}
          className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-6 tw:p-0"
        >
          {listed.map((result) => (
            <li key={searchResultKey(result)}>
              <SearchResult result={result} terms={terms} />
            </li>
          ))}
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
