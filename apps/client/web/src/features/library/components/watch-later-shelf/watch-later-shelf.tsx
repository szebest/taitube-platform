import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { FeedVideoCard } from '#app/features/browse/components/feed-video-card/feed-video-card';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { YouShelf } from '../you-shelf/you-shelf';

const NO_PLAYLIST = '';

export function WatchLaterShelf() {
  const api = useApi();
  const { tOr } = useT();
  const { data: playlists } = useSuspenseQuery(myPlaylistsQueryOptions(api));
  const watchLater = playlists.items.find(({ isSystem }) => isSystem);
  const { data: playlist } = useQuery({
    ...playlistQueryOptions(api, watchLater?.id ?? NO_PLAYLIST),
    enabled: watchLater !== undefined,
  });

  return (
    <YouShelf
      shelf="watchLater"
      link={(label) => (
        <Link to="/playlist" search={{ list: watchLater?.id ?? NO_PLAYLIST }}>
          {label}
        </Link>
      )}
      action={{
        label: tOr('library.browse', {}, ''),
        link: (label) => <Link to="/">{label}</Link>,
      }}
    >
      {(playlist?.items ?? []).map(({ id, video }) => (
        <Shelf.Item key={id}>
          <FeedVideoCard video={video} />
        </Shelf.Item>
      ))}
    </YouShelf>
  );
}
