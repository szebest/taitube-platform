import type { PlaylistView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { SortableList } from '@vp/ui';

import { planDrop } from '../api/playlist-order';
import { useReorderPlaylist } from '../hooks/use-reorder-playlist';
import { PlaylistVideoRow } from './playlist-video-row';

const LIST = 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-stack tw:p-0';

export interface PlaylistItemsProps {
  playlist: PlaylistView;
  /** The owner may drag, and has the item menu. */
  canManage: boolean;
}

/** A playlist's videos in order; the owner drags a row by its handle, or with the keyboard, to move it. */
export function PlaylistItems({ playlist, canManage }: PlaylistItemsProps) {
  const { tOr } = useT();
  const reorder = useReorderPlaylist(playlist.id);
  const label = tOr('library.playlistItems', { title: playlist.title }, '');

  if (!canManage) {
    return (
      <ul aria-label={label} className={LIST}>
        {playlist.items.map(({ id }, index) => (
          <li key={id}>
            <PlaylistVideoRow playlist={playlist} index={index} canManage={false} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <SortableList.Root
      aria-label={label}
      items={playlist.items.map(({ id }) => id)}
      onReorder={(order) => {
        const move = planDrop(playlist.items, order);
        if (move) reorder.mutate(move);
      }}
      className={LIST}
    >
      {playlist.items.map(({ id, video }, index) => (
        <SortableList.Item key={id} id={id} aria-label={video.title ?? undefined}>
          <SortableList.Handle />
          <PlaylistVideoRow playlist={playlist} index={index} canManage />
        </SortableList.Item>
      ))}
    </SortableList.Root>
  );
}
