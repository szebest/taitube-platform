import { DropdownMenu, Icon, IconButton, SortableList } from '@kit/ui';
import { canManagePlaylistItems, type PlaylistResource } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { PlaylistSectionRow } from '#app/components/playlist/playlist-item-row';
import { useRemovePlaylistSection } from '#app/features/library/hooks/use-remove-playlist-section';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface PlaylistSectionEntryProps {
  playlistId: string;
  access: PlaylistResource;
  section: { id: string; title: string };
  /** The videos under it, up to the next section. */
  count: number;
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
  /** False on a smart playlist, whose rows nobody changes. */
  editable: boolean;
}

/** A section divider: it folds the videos under it, and a manager renames or removes it. */
export function PlaylistSectionEntry({
  playlistId,
  access,
  section,
  count,
  folded,
  onFoldedChange,
  editable,
}: PlaylistSectionEntryProps) {
  const { tOr } = useT();
  const { open } = urlModals.useUrlModal('playlist-section');
  const remove = useRemovePlaylistSection(playlistId);
  const canManage = useCan(canManagePlaylistItems, { playlist: access }) && editable;

  const { id, title } = section;

  return (
    <SortableList.Item id={id} aria-label={title}>
      <SortableList.Handle />
      <PlaylistSectionRow.Root folded={folded} onFoldedChange={onFoldedChange}>
        <PlaylistSectionRow.Title>{title}</PlaylistSectionRow.Title>
        <PlaylistSectionRow.Count>
          {tOr('library.playlistCount', { count }, '')}
        </PlaylistSectionRow.Count>
        {canManage && (
          <PlaylistSectionRow.Actions>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <IconButton
                  size="sm"
                  aria-label={tOr('playlistEdit.sectionActions', { title }, '')}
                >
                  <Icon name="more" />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onSelect={() => open({ sectionId: id })}>
                  <Icon name="edit" />
                  {tOr('playlistEdit.renameSection', {}, '')}
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => remove.mutate(id)}>
                  <Icon name="trash" />
                  {tOr('playlistEdit.removeSection', {}, '')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </PlaylistSectionRow.Actions>
        )}
      </PlaylistSectionRow.Root>
    </SortableList.Item>
  );
}
