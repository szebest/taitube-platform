import { EmptyLibraryIllustration, EmptyState } from '@kit/components';
import { Callout, SortableList } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { canManagePlaylistItems, type PlaylistResource } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useState } from 'react';
import { useHasCollaborators } from '#app/features/library/hooks/use-has-collaborators';
import { useReorderPlaylist } from '#app/features/library/hooks/use-reorder-playlist';
import {
  buildPlaylistRows,
  expandFoldedOrder,
  unfoldedRows,
} from '#app/features/library/utils/playlist-rows';
import { useT } from '#app/lib/messages';
import { PlaylistSectionEntry } from './components/playlist-section-entry/playlist-section-entry';
import { PlaylistVideoEntry } from './components/playlist-video-entry/playlist-video-entry';

export interface PlaylistItemsProps {
  playlist: PlaylistView;
  /** The playlist with the viewer's seat on it, for the permission rules. */
  access: PlaylistResource;
  /** The item ids picked for a bulk action, or null while not selecting. */
  selection: readonly string[] | null;
  onSelectionChange: (selection: readonly string[]) => void;
}

/** The playlist's videos and sections in order: a manager drags them, and a section folds the videos under it. */
export function PlaylistItems({
  playlist,
  access,
  selection,
  onSelectionChange,
}: PlaylistItemsProps) {
  const { tOr } = useT();
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const reorder = useReorderPlaylist(playlist.id);
  const showAdder = useHasCollaborators(playlist);
  const smart = playlist.rules !== null;
  const arrangeable = useCan(canManagePlaylistItems, { playlist: access }) && !smart;

  const rows = buildPlaylistRows(playlist);
  const shown = unfoldedRows(rows, folded);
  const order = rows.map(({ id }) => id);

  const fold = (sectionId: string, next: boolean) =>
    setFolded((current) =>
      next
        ? new Set([...current, sectionId])
        : new Set([...current].filter((id) => id !== sectionId))
    );

  const select = (itemId: string, selected: boolean) =>
    onSelectionChange(
      selected
        ? [...(selection ?? []), itemId]
        : (selection ?? []).filter((candidate) => candidate !== itemId)
    );

  if (rows.length === 0) {
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
    <div className="flex flex-col gap-stack">
      {smart && (
        <Callout.Root tone="info">
          <Callout.Body>{tOr('playlistEdit.smartReadOnly', {}, '')}</Callout.Body>
        </Callout.Root>
      )}
      <SortableList.Root
        items={shown.map(({ id }) => id)}
        onReorder={(next) => reorder.mutate(expandFoldedOrder(next, rows, folded))}
        aria-label={tOr('library.playlistItems', { title: playlist.title }, '')}
        aria-disabled={!arrangeable || selection !== null || undefined}
        className="gap-stack"
      >
        {shown.map((row) =>
          row.kind === 'section' ? (
            <PlaylistSectionEntry
              key={row.id}
              playlistId={playlist.id}
              access={access}
              section={row.section}
              count={row.count}
              folded={folded.has(row.id)}
              onFoldedChange={(next) => fold(row.id, next)}
              editable={!smart}
            />
          ) : (
            <PlaylistVideoEntry
              key={row.id}
              playlist={playlist}
              access={access}
              item={row.item}
              order={order}
              arrangeable={arrangeable}
              showAdder={showAdder}
              selection={
                selection && {
                  selected: selection.includes(row.id),
                  onSelectedChange: (selected) => select(row.id, selected),
                }
              }
            />
          )
        )}
      </SortableList.Root>
    </div>
  );
}
