import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { myPlaylistsQueryOptions } from '../api/library-queries';
import { YouPlaylistCard } from './you-playlist-card';
import { YouShelf } from './you-shelf';

/** The viewer's own playlists; Watch Later has a shelf of its own. */
export function PlaylistsShelf() {
  const api = useApi();
  const { tOr } = useT();
  const { data } = useSuspenseQuery(myPlaylistsQueryOptions(api));

  return (
    <YouShelf
      shelf="playlists"
      link={(label) => <a href="/feed/playlists">{label}</a>}
      action={{
        label: tOr('library.browse', {}, ''),
        link: (label) => <Link to="/">{label}</Link>,
      }}
    >
      {data.items
        .filter(({ isSystem }) => !isSystem)
        .map(({ id, title, videoCount }) => (
          <Shelf.Item key={id}>
            <YouPlaylistCard id={id} title={title} videoCount={videoCount} />
          </Shelf.Item>
        ))}
    </YouShelf>
  );
}
