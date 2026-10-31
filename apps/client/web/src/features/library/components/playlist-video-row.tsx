import type { PlaylistView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { DropdownMenu, Icon } from '@vp/ui';

import { planMove } from '../api/playlist-order';
import { useRemovePlaylistItem } from '../hooks/use-remove-playlist-item';
import { useReorderPlaylist } from '../hooks/use-reorder-playlist';
import { LibraryVideoRow } from './library-video-row';

export interface PlaylistVideoRowProps {
  playlist: PlaylistView;
  index: number;
  /** The owner's menu: move to either end, remove. */
  canManage: boolean;
}

/** One item of a playlist as a `row` card, played from the playlist; the owner's menu edits the list. */
export function PlaylistVideoRow({ playlist, index, canManage }: PlaylistVideoRowProps) {
  const { tOr } = useT();
  const reorder = useReorderPlaylist(playlist.id);
  const remove = useRemovePlaylistItem(playlist.id);
  const { items } = playlist;
  const item = items[index];
  if (!item) return null;

  const moveTo = (toIndex: number) => {
    const move = planMove(items, item.id, toIndex);
    if (move) reorder.mutate(move);
  };

  return (
    <LibraryVideoRow
      video={item.video}
      at={item.addedAt}
      playlist={{ id: playlist.id, index }}
      actions={
        canManage && (
          <>
            <DropdownMenu.Item disabled={index === 0} onSelect={() => moveTo(0)}>
              {tOr('library.moveToTop', {}, '')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={index === items.length - 1}
              onSelect={() => moveTo(items.length - 1)}
            >
              {tOr('library.moveToBottom', {}, '')}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => remove.mutate(item.videoId)}>
              <Icon name="trash" />
              {tOr('library.removeFromPlaylist', {}, '')}
            </DropdownMenu.Item>
          </>
        )
      }
    />
  );
}
