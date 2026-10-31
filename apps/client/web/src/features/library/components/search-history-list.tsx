import { Link } from '@tanstack/react-router';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Icon, IconButton } from '@vp/ui';

import { searchHistoryQueryOptions } from '../api/library-queries';
import { usePagedItems } from '../hooks/use-paged-items';
import { useRemoveSearch } from '../hooks/use-remove-search';
import { LibraryEmpty } from './library-empty';
import { PagedFooter } from './paged-footer';

interface SearchHistoryEntryProps {
  id: string;
  query: string;
  searchedAt: string;
}

function SearchHistoryEntry({ id, query, searchedAt }: SearchHistoryEntryProps) {
  const { tOr } = useT();
  const { mutate } = useRemoveSearch(id);

  return (
    <li className="tw:flex tw:items-center tw:gap-3">
      <Icon name="search" />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <Link to="/search" search={{ q: query }} className="tw:truncate tw:text-fg">
          {query}
        </Link>
        <time dateTime={searchedAt} className="tw:text-body-sm tw:text-fg-muted">
          <Format value={publishedAt(searchedAt).relative} />
        </time>
      </div>
      <IconButton aria-label={tOr('library.removeSearch', { query }, '')} onClick={() => mutate()}>
        <Icon name="close" />
      </IconButton>
    </li>
  );
}

/** What the viewer searched for, newest first; each entry searches again, or is forgotten. */
export function SearchHistoryList() {
  const api = useApi();
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    searchHistoryQueryOptions(api)
  );

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="searches" />}
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
        {items.map(({ id, query, searchedAt }) => (
          <SearchHistoryEntry key={id} id={id} query={query} searchedAt={searchedAt} />
        ))}
      </ul>
      <PagedFooter
        hasMore={hasMore}
        isFetching={isFetching}
        isError={isError}
        onLoadMore={loadMore}
      />
    </div>
  );
}
