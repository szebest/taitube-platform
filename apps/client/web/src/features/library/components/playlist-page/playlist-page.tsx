import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { canAddPlaylistItem, canUpdatePlaylist } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { usePlaylistAccess } from '#app/features/library/hooks/use-playlist-access';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { urlModals } from '#app/lib/url-modal/registry';
import { DeletePlaylistDialog } from '../delete-playlist-dialog/delete-playlist-dialog';
import { PlaylistHero } from '../playlist-hero/playlist-hero';
import { LazyPlaylistImportDialog } from '../playlist-import-dialog/playlist-import-dialog.lazy';
import { LazyPlaylistItemDialog } from '../playlist-item-dialog/playlist-item-dialog.lazy';
import { PlaylistItems } from '../playlist-items/playlist-items';
import { LazyPlaylistMergeDialog } from '../playlist-merge-dialog/playlist-merge-dialog.lazy';
import { LazyPlaylistSectionDialog } from '../playlist-section-dialog/playlist-section-dialog.lazy';
import { PlaylistSelectionBar } from '../playlist-selection-bar/playlist-selection-bar';
import { PlaylistToolbar } from '../playlist-toolbar/playlist-toolbar';
import { LazyPlaylistTransferDialog } from '../playlist-transfer-dialog/playlist-transfer-dialog.lazy';
import { SortedPlaylistItems } from '../sorted-playlist-items/sorted-playlist-items';

const { UrlModal } = urlModals;

/**
 * `/playlist?list=&sort=`: the hero, the tools, and the videos in the playlist's order or a viewing
 * order; what the viewer may change comes from the ability over their seat on it.
 */
export function PlaylistPage() {
  const [selection, setSelection] = useState<readonly string[] | null>(null);
  const { list, sort = 'manual', s: shareToken } = useSearch({ from: '/playlist' });
  const api = useApi();
  const { data: playlist } = useSuspenseQuery(playlistQueryOptions(api, list, shareToken));
  const access = usePlaylistAccess(playlist);
  const canUpdate = useCan(canUpdatePlaylist, { playlist: access });
  const canImport = useCan(canAddPlaylistItem, { playlist: access }) && playlist.rules === null;

  return (
    <div className="flex flex-col gap-section">
      <PlaylistHero playlist={playlist} editable={canUpdate && !playlist.isSystem} />
      <div className="flex flex-col gap-stack">
        <PlaylistToolbar
          playlist={playlist}
          access={access}
          sort={sort}
          selecting={selection !== null}
          onSelectingChange={(selecting) => setSelection(selecting ? [] : null)}
        />
        {selection !== null && (
          <PlaylistSelectionBar count={selection.length} onCancel={() => setSelection(null)} />
        )}
        {sort === 'manual' ? (
          <PlaylistItems
            playlist={playlist}
            access={access}
            selection={selection}
            onSelectionChange={setSelection}
          />
        ) : (
          <SortedPlaylistItems
            playlistId={playlist.id}
            title={playlist.title}
            sort={sort}
            shareToken={shareToken}
          />
        )}
      </div>
      <DeletePlaylistDialog />
      <UrlModal.WhenOpened id="playlist-item">
        <LazyPlaylistItemDialog playlist={playlist} />
      </UrlModal.WhenOpened>
      <UrlModal.WhenOpened id="playlist-section">
        <LazyPlaylistSectionDialog playlist={playlist} />
      </UrlModal.WhenOpened>
      <UrlModal.WhenOpened id="playlist-transfer">
        <LazyPlaylistTransferDialog
          playlist={playlist}
          selection={selection ?? []}
          onDone={() => setSelection(null)}
        />
      </UrlModal.WhenOpened>
      <UrlModal.WhenOpened id="playlist-merge">
        <LazyPlaylistMergeDialog playlist={playlist} canMergeHere={canImport} />
      </UrlModal.WhenOpened>
      <UrlModal.WhenOpened id="playlist-import">
        <LazyPlaylistImportDialog playlistId={playlist.id} canImport={canImport} />
      </UrlModal.WhenOpened>
    </div>
  );
}
