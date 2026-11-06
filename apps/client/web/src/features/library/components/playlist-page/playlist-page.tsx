import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { canUpdatePlaylist } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { playlistQueryOptions } from '../api/library-queries';
import { DeletePlaylistDialog } from './delete-playlist-dialog';
import { PlaylistHero } from './playlist-hero';
import { PlaylistItems } from './playlist-items';

/** `/playlist?list=`: the playlist's hero and its videos in order; the owner's controls come from the ability. */
export function PlaylistPage() {
  const { list } = useSearch({ from: '/playlist' });
  const api = useApi();
  const { data: playlist } = useSuspenseQuery(playlistQueryOptions(api, list));
  const canUpdate = useCan(canUpdatePlaylist, { playlist });

  return (
    <div className="flex flex-col gap-section">
      <PlaylistHero playlist={playlist} editable={canUpdate && !playlist.isSystem} />
      <PlaylistItems playlist={playlist} editable={canUpdate} />
      <DeletePlaylistDialog />
    </div>
  );
}
