import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyLibraryIllustration, EmptyState, PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button, Icon } from '@vp/ui';

import { urlModals } from '#app/features/url-modal/registry';

import { myPlaylistsQueryOptions } from '../api/library-queries';
import { YouPlaylistCard } from './you-playlist-card';

const { useUrlModal } = urlModals;

/** `/feed/playlists`: the viewer's playlists as a grid, with Watch Later first. */
export function PlaylistsPage() {
  const api = useApi();
  const { tOr } = useT();
  const { open } = useUrlModal('new-playlist');
  const { data } = useSuspenseQuery(myPlaylistsQueryOptions(api));

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('library.playlistsTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Actions>
          <Button variant="solid" tone="accent" onClick={() => open({})}>
            <Icon name="plus" />
            {tOr('library.newPlaylist', {}, '')}
          </Button>
        </PageHeader.Actions>
      </PageHeader.Root>
      {data.items.length > 0 ? (
        <ul
          aria-label={tOr('library.playlistsLabel', {}, '')}
          className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-stack p-0"
        >
          {data.items.map(({ id, title, videoCount }) => (
            <li key={id}>
              <YouPlaylistCard id={id} title={title} videoCount={videoCount} variant="grid" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState.Root size="section" role="status">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>
            {tOr('library.shelfEmpty', { shelf: 'playlists' }, '')}
          </EmptyState.Title>
          <EmptyState.Action onClick={() => open({})}>
            {tOr('library.newPlaylist', {}, '')}
          </EmptyState.Action>
        </EmptyState.Root>
      )}
    </div>
  );
}
