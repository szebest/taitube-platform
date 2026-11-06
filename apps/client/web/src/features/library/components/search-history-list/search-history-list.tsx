import { Link } from '@tanstack/react-router';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Icon, IconButton } from '@vp/ui';
import { searchHistoryQueryOptions } from '#app/features/library/api/library-queries';
import { usePagedItems } from '#app/features/library/hooks/use-paged-items';
import { useRemoveSearch } from '#app/features/library/hooks/use-remove-search';
import { LibraryEmpty } from '../library-empty/library-empty';
import { PagedFooter } from '../paged-footer/paged-footer';

interface SearchHistoryEntryProps {
  id: string;
  query: string;
  searchedAt: string;
}

function SearchHistoryEntry({ id, query, searchedAt }: SearchHistoryEntryProps) {
  const { tOr } = useT();
  const { mutate } = useRemoveSearch(id);

  return (
    <li className="flex items-center gap-3">
      <Icon name="search" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link to="/search" search={{ q: query }} className="truncate text-fg">
          {query}
        </Link>
        <time dateTime={searchedAt} className="text-body-sm text-fg-muted">
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
    <div className="flex flex-col gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="searches" />}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
