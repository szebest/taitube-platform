import { useApi } from '@vp/queries';

import { likedVideosQueryOptions } from '../api/library-queries';
import { usePagedItems } from '../hooks/use-paged-items';
import { LibraryEmpty } from './library-empty';
import { LikedVideoRow } from './liked-video-row';
import { PagedFooter } from './paged-footer';

/** The videos the viewer liked, newest like first. */
export function LikedList() {
  const api = useApi();
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    likedVideosQueryOptions(api)
  );

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="liked" />}
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-4 tw:p-0">
        {items.map((video) => (
          <li key={video.id}>
            <LikedVideoRow video={video} />
          </li>
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
