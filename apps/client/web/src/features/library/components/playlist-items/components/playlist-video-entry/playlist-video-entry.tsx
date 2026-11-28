import { DropdownMenu, Icon, Progress, SortableList } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import {
  canManagePlaylistItems,
  canRemovePlaylistItem,
  type PlaylistResource,
} from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { PlaylistItemRow } from '#app/components/playlist/playlist-item-row';
import { LibraryVideoRow } from '#app/features/library/components/library-video-row/library-video-row';
import { useRemovePlaylistItem } from '#app/features/library/hooks/use-remove-playlist-item';
import { useReorderPlaylist } from '#app/features/library/hooks/use-reorder-playlist';
import { useSegmentText } from '#app/features/library/hooks/use-segment-text';
import { type PlaylistEdge, moveToEdge } from '#app/features/library/utils/playlist-order';
import type { PlaylistItemView } from '#app/features/library/utils/playlist-rows';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface PlaylistVideoEntryProps {
  playlist: PlaylistView;
  access: PlaylistResource;
  item: PlaylistItemView;
  /** Every row id of the playlist in order, sections included, for Move to top and bottom. */
  order: readonly string[];
  /** The viewer may reorder the playlist. */
  arrangeable: boolean;
  /** Each item names who added it. */
  showAdder: boolean;
  /** While the bulk selection is on: whether this item is in it, and how to change that. */
  selection: { selected: boolean; onSelectedChange: (selected: boolean) => void } | null;
}

/** One video of the playlist: its row, note, segment and adder, and the actions this viewer may take on it. */
export function PlaylistVideoEntry({
  playlist,
  access,
  item,
  order,
  arrangeable,
  showAdder,
  selection,
}: PlaylistVideoEntryProps) {
  const { tOr } = useT();
  const { segment } = useSegmentText();
  const reorder = useReorderPlaylist(playlist.id);
  const remove = useRemovePlaylistItem(playlist.id);
  const { open } = urlModals.useUrlModal('playlist-item');
  const own = { playlist: { ...access, addedBy: item.addedBy?.userId ?? null } };
  const smart = playlist.rules !== null;
  const canRemove = useCan(canRemovePlaylistItem, own) && !smart;
  const canAnnotate = useCan(canManagePlaylistItems, own) && !smart;

  const { id, videoId, video, addedAt, addedBy, episode, progress, note } = item;
  const title = video.title ?? tOr('browse.untitled', {}, '');
  const series = playlist.kind === 'series';
  const segmentText = segment(item.startMs, item.endMs);
  const adder = showAdder ? addedBy?.channel : null;
  const index = playlist.items.findIndex((candidate) => candidate.id === id);

  const moveTo = (edge: PlaylistEdge) => reorder.mutate(moveToEdge(order, id, edge));

  return (
    <SortableList.Item id={id} aria-label={title} className="items-start">
      <SortableList.Handle />
      <PlaylistItemRow.Root selected={selection?.selected ?? false}>
        {selection && (
          <PlaylistItemRow.Select
            checked={selection.selected}
            onCheckedChange={selection.onSelectedChange}
            aria-label={tOr('playlistEdit.selectItem', { title }, '')}
          />
        )}
        <PlaylistItemRow.Body>
          {series && episode !== null && (
            <p className="m-0 text-overline text-fg-muted uppercase">
              {tOr('library.episode', { number: episode }, '')}
            </p>
          )}
          <LibraryVideoRow
            video={video}
            at={addedAt}
            playlist={{ id: playlist.id, index }}
            actions={
              <>
                {arrangeable && (
                  <>
                    <DropdownMenu.Item onSelect={() => moveTo('top')}>
                      <Icon name="sort" />
                      {tOr('library.moveToTop', {}, '')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => moveTo('bottom')}>
                      <Icon name="sort" />
                      {tOr('library.moveToBottom', {}, '')}
                    </DropdownMenu.Item>
                  </>
                )}
                {canAnnotate && (
                  <DropdownMenu.Item onSelect={() => open({ itemId: id })}>
                    <Icon name="edit" />
                    {tOr('playlistEdit.editItem', {}, '')}
                  </DropdownMenu.Item>
                )}
                {canRemove && (
                  <DropdownMenu.Item onSelect={() => remove.mutate(videoId)}>
                    <Icon name="trash" />
                    {tOr('library.removeFromPlaylist', {}, '')}
                  </DropdownMenu.Item>
                )}
              </>
            }
          />
          {series && progress !== null && (
            <Progress
              size="sm"
              value={progress}
              aria-label={tOr('library.episodeWatched', { percent: progress }, '')}
            />
          )}
        </PlaylistItemRow.Body>
        {note !== null && <PlaylistItemRow.Note>{note}</PlaylistItemRow.Note>}
        {segmentText !== null && <PlaylistItemRow.Segment>{segmentText}</PlaylistItemRow.Segment>}
        {adder && (
          <PlaylistItemRow.Adder
            src={adder.avatarUrl ?? undefined}
            name={adder.displayName}
            label={tOr('playlistEdit.addedBy', { name: adder.displayName }, '')}
          />
        )}
      </PlaylistItemRow.Root>
    </SortableList.Item>
  );
}
