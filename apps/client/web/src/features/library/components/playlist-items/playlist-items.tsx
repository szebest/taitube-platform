import type { PlaylistView } from '@vp/api-contracts';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { DropdownMenu, Icon, SortableList } from '@vp/ui';
import { useRemovePlaylistItem } from '../hooks/use-remove-playlist-item';
import { useReorderPlaylist } from '../hooks/use-reorder-playlist';
import { type PlaylistEdge, moveToEdge } from '../playlist-order';
import { LibraryVideoRow } from './library-video-row';

export interface PlaylistItemsProps {
  playlist: PlaylistView;
  /** Drag, reorder and the item menu are the owner's. */
  editable: boolean;
}

/** The playlist's videos in order; the owner drags them, or moves them from the item menu. */
export function PlaylistItems({ playlist, editable }: PlaylistItemsProps) {
  const { tOr } = useT();
  const reorder = useReorderPlaylist(playlist.id);
  const remove = useRemovePlaylistItem(playlist.id);

  const ids = playlist.items.map(({ id }) => id);
  const moveTo = (id: string, edge: PlaylistEdge) => reorder.mutate(moveToEdge(ids, id, edge));

  if (ids.length === 0) {
    return (
      <EmptyState.Root size="section" role="status">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>{tOr('library.playlistEmpty', {}, '')}</EmptyState.Title>
      </EmptyState.Root>
    );
  }

  return (
    <SortableList.Root
      items={ids}
      onReorder={(next) => reorder.mutate([...next])}
      aria-label={tOr('library.playlistItems', { title: playlist.title }, '')}
      aria-disabled={!editable || undefined}
      className="gap-stack"
    >
      {playlist.items.map(({ id, videoId, video, addedAt }, index) => (
        <SortableList.Item
          key={id}
          id={id}
          aria-label={video.title ?? tOr('browse.untitled', {}, '')}
          className="items-start"
        >
          <SortableList.Handle />
          <div className="min-w-0 flex-1">
            <LibraryVideoRow
              video={video}
              at={addedAt}
              playlist={{ id: playlist.id, index }}
              actions={
                editable ? (
                  <>
                    <DropdownMenu.Item onSelect={() => moveTo(id, 'top')}>
                      <Icon name="sort" />
                      {tOr('library.moveToTop', {}, '')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => moveTo(id, 'bottom')}>
                      <Icon name="sort" />
                      {tOr('library.moveToBottom', {}, '')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => remove.mutate(videoId)}>
                      <Icon name="trash" />
                      {tOr('library.removeFromPlaylist', {}, '')}
                    </DropdownMenu.Item>
                  </>
                ) : undefined
              }
            />
          </div>
        </SortableList.Item>
      ))}
    </SortableList.Root>
  );
}
