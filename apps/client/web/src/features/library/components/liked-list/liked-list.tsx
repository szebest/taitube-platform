import { useApi } from '@vp/queries';
import { PagedFooter } from '#app/components/feed/paged-footer';
import { likedVideosQueryOptions } from '#app/features/library/api/library-queries';
import { usePagedItems } from '#app/features/library/hooks/use-paged-items';
import { LibraryEmpty } from '../library-empty/library-empty';
import { LikedVideoRow } from '../liked-video-row/liked-video-row';

/** The videos the viewer liked, newest like first. */
export function LikedList() {
  const api = useApi();
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    likedVideosQueryOptions(api)
  );

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="liked" />}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
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
