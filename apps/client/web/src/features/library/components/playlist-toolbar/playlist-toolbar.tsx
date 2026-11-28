import { Button, DropdownMenu, Icon } from '@kit/ui';
import { useNavigate } from '@tanstack/react-router';
import type { PlaylistView } from '@vp/api-contracts';
import { PLAYLIST_ITEM_SORTS, type PlaylistItemSort } from '@vp/domain';
import { canAddPlaylistItem, canManagePlaylistItems, type PlaylistResource } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useSortPlaylist } from '#app/features/library/hooks/use-sort-playlist';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface PlaylistToolbarProps {
  playlist: PlaylistView;
  access: PlaylistResource;
  sort: PlaylistItemSort;
  selecting: boolean;
  onSelectingChange: (selecting: boolean) => void;
}

/** Above the rows: the viewing order, writing it back, a new section, bulk selection, import and export. */
export function PlaylistToolbar({
  playlist,
  access,
  sort,
  selecting,
  onSelectingChange,
}: PlaylistToolbarProps) {
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/playlist' });
  const { run } = useRequireAccount('playlist');
  const section = urlModals.useUrlModal('playlist-section');
  const porting = urlModals.useUrlModal('playlist-import');
  const saveOrder = useSortPlaylist(playlist.id);
  const smart = playlist.rules !== null;
  const canManage = useCan(canManagePlaylistItems, { playlist: access }) && !smart;
  const canAdd = useCan(canAddPlaylistItem, { playlist: access }) && !smart;

  const pickSort = (next: string) => {
    const picked = PLAYLIST_ITEM_SORTS.find((option) => option === next);
    if (!picked) return;

    void navigate({
      search: (previous) => ({ ...previous, sort: picked === 'manual' ? undefined : picked }),
      replace: true,
    });
  };

  return (
    <div
      role="toolbar"
      aria-label={tOr('playlistEdit.toolbarLabel', {}, '')}
      className="flex flex-wrap items-center gap-inline"
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="soft" tone="neutral" size="sm">
            <Icon name="sort" />
            {tOr('playlistEdit.sortMenu', { sort }, '')}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          <DropdownMenu.RadioGroup value={sort} onValueChange={pickSort}>
            {PLAYLIST_ITEM_SORTS.map((option) => (
              <DropdownMenu.RadioItem key={option} value={option}>
                {tOr('playlistEdit.sort', { sort: option }, '')}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {canManage && sort !== 'manual' && (
        <Button
          variant="soft"
          tone="accent"
          size="sm"
          loading={saveOrder.isPending}
          onClick={() => saveOrder.mutate(sort, { onSuccess: () => pickSort('manual') })}
        >
          {tOr('playlistEdit.saveOrder', {}, '')}
        </Button>
      )}
      {canManage && (
        <Button variant="ghost" size="sm" onClick={() => section.open({})}>
          <Icon name="plus" />
          {tOr('playlistEdit.addSection', {}, '')}
        </Button>
      )}
      {!smart && sort === 'manual' && (
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={selecting}
          onClick={() => run(() => onSelectingChange(!selecting))}
        >
          <Icon name="check" />
          {tOr('playlistEdit.select', {}, '')}
        </Button>
      )}
      {canAdd && (
        <Button variant="ghost" size="sm" onClick={() => porting.open({ direction: 'import' })}>
          <Icon name="upload" />
          {tOr('playlistEdit.import', {}, '')}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => porting.open({ direction: 'export' })}>
        <Icon name="save" />
        {tOr('playlistEdit.export', {}, '')}
      </Button>
    </div>
  );
}
