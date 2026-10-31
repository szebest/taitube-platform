import { EmptyState, NoResultsIllustration } from '@vp/components';
import { useFormat, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { watchHistoryQueryOptions } from '../api/library-queries';
import { filterByTitle, groupByDay } from '../history-groups';
import { usePagedItems } from '../hooks/use-paged-items';
import { HistoryVideoRow } from './history-video-row';
import { LibraryEmpty } from './library-empty';
import { PagedFooter } from './paged-footer';

export interface HistoryListProps {
  /** The words the titles are filtered by. */
  filter?: string;
}

/** The watch history, newest first in day groups; the filter narrows what has been loaded. */
export function HistoryList({ filter = '' }: HistoryListProps) {
  const api = useApi();
  const { tOr } = useT();
  const { context } = useFormat();
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    watchHistoryQueryOptions(api)
  );

  const shown = filterByTitle(items, filter);
  const groups = groupByDay(shown, context.now);

  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="history" />}
      {items.length > 0 && shown.length === 0 && !hasMore && (
        <EmptyState.Root size="section" role="status">
          <EmptyState.Illustration>
            <NoResultsIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('library.noMatches', { query: filter }, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {groups.map(({ id, items: group }) => (
        <section
          key={id}
          aria-labelledby={`history-group-${id}`}
          className="tw:flex tw:flex-col tw:gap-3"
        >
          <h2 id={`history-group-${id}`} className="tw:m-0 tw:text-title">
            {tOr('library.group', { group: id }, '')}
          </h2>
          <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-4 tw:p-0">
            {group.map((item) => (
              <li key={item.id}>
                <HistoryVideoRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <PagedFooter
        hasMore={hasMore}
        isFetching={isFetching}
        isError={isError}
        onLoadMore={loadMore}
      />
    </div>
  );
}
