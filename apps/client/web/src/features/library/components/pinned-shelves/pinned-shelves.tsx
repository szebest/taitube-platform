import { EmptyLibraryIllustration, EmptyState, Shelf, ShelfSkeleton } from '@kit/components';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { FeedVideoCard } from '#app/components/video/feed-video-card';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { pinnedPlaylists } from '#app/features/library/utils/pinned-playlists';
import { useT } from '#app/lib/messages';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';

/** A shelf for each playlist the viewer pinned, the oldest pin first, showing its first videos. */
export function PinnedShelves() {
  const api = useApi();
  const { tOr } = useT();
  const { data } = useSuspenseQuery(myPlaylistsQueryOptions(api));
  const pinned = pinnedPlaylists(data.items);
  const details = useQueries({
    queries: pinned.map(({ id }) => playlistQueryOptions(api, id)),
  });

  return pinned.map(({ id, title }, index) => {
    const detail = details[index];
    if (detail?.isPending) return <ShelfSkeleton key={id} />;

    const items = detail?.data?.items ?? [];
    return (
      <Shelf.Root key={id}>
        <Shelf.Header>
          <Shelf.Title asChild>
            <h2>
              <Link to="/playlist" search={{ list: id }}>
                {title}
              </Link>
            </h2>
          </Shelf.Title>
        </Shelf.Header>
        {items.length > 0 ? (
          <Shelf.Track>
            {items.map(({ id: itemId, video }) => (
              <Shelf.Item key={itemId}>
                <FeedVideoCard video={video} />
              </Shelf.Item>
            ))}
          </Shelf.Track>
        ) : (
          <EmptyState.Root size="inline" role="status">
            <EmptyState.Illustration>
              <EmptyLibraryIllustration />
            </EmptyState.Illustration>
            <EmptyState.Title>{tOr('library.playlistEmpty', {}, '')}</EmptyState.Title>
          </EmptyState.Root>
        )}
      </Shelf.Root>
    );
  });
}
