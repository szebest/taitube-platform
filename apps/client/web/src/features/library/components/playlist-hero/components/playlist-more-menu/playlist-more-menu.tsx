import { DropdownMenu, Icon, IconButton, type IconId } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { useLeavePlaylist } from '#app/features/library/hooks/use-collaborator-changes';
import { useCopyPlaylist } from '#app/features/library/hooks/use-copy-playlist';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

const { useUrlModal } = urlModals;

export interface PlaylistMoreMenuProps {
  playlist: PlaylistView;
  abilities: PlaylistAbilities;
  /** The details form, for whoever may retitle the playlist; absent while it is open. */
  onEdit?: () => void;
}

type MenuAction =
  | 'collaborators'
  | 'activity'
  | 'shareLinks'
  | 'stats'
  | 'settings'
  | 'rules'
  | 'freeze'
  | 'leave';

interface MenuEntry {
  key: string;
  icon: IconId;
  label: string;
  tone?: 'danger';
  onSelect: () => void;
}

/** Everything about the playlist that is not playing it, each entry shown only to whoever may use it. */
export function PlaylistMoreMenu({ playlist, abilities, onEdit }: PlaylistMoreMenuProps) {
  const { tOr } = useT();
  const collaborators = useUrlModal('playlist-collaborators');
  const activity = useUrlModal('playlist-activity');
  const shareLinks = useUrlModal('playlist-share-links');
  const stats = useUrlModal('playlist-stats');
  const settings = useUrlModal('playlist-settings');
  const rules = useUrlModal('playlist-rules');
  const remove = useUrlModal('delete-playlist');
  const freeze = useCopyPlaylist(playlist.id, 'freeze');
  const leave = useLeavePlaylist(playlist.id, playlist.title);

  const { id, isSystem } = playlist;
  const smart = playlist.rules !== null;
  const item = (action: MenuAction) => tOr('playlistPeople.menu', { action }, '');
  const entries: (MenuEntry | false | undefined)[] = [
    abilities.seeCollaborators && {
      key: 'collaborators',
      icon: 'you',
      label: item('collaborators'),
      onSelect: () => collaborators.open({}),
    },
    abilities.readActivity && {
      key: 'activity',
      icon: 'history',
      label: item('activity'),
      onSelect: () => activity.open({}),
    },
    abilities.share &&
      !isSystem && {
        key: 'shareLinks',
        icon: 'globe',
        label: item('shareLinks'),
        onSelect: () => shareLinks.open({}),
      },
    abilities.readStats && {
      key: 'stats',
      icon: 'chart',
      label: item('stats'),
      onSelect: () => stats.open({}),
    },
    abilities.configure && {
      key: 'settings',
      icon: 'settings',
      label: item('settings'),
      onSelect: () => settings.open({}),
    },
    smart &&
      abilities.editRules && {
        key: 'rules',
        icon: 'filter',
        label: item('rules'),
        onSelect: () => rules.open({}),
      },
    smart &&
      abilities.editRules && {
        key: 'freeze',
        icon: 'save',
        label: item('freeze'),
        onSelect: () => freeze.mutate(),
      },
    onEdit && {
      key: 'edit',
      icon: 'edit',
      label: tOr('library.editPlaylist', {}, ''),
      onSelect: onEdit,
    },
    abilities.leave && {
      key: 'leave',
      icon: 'close',
      label: item('leave'),
      tone: 'danger',
      onSelect: () => leave.mutate(),
    },
    abilities.delete &&
      !isSystem && {
        key: 'delete',
        icon: 'trash',
        label: tOr('library.deletePlaylist', {}, ''),
        tone: 'danger',
        onSelect: () => remove.open({ playlistId: id }),
      },
  ];
  const shown = entries.filter((entry): entry is MenuEntry => Boolean(entry));

  if (shown.length === 0) {
    return null;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="ghost" aria-label={tOr('playlistPeople.more', {}, '')}>
          <Icon name="more-h" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {shown.map(({ key, icon, label, tone, onSelect }) => (
          <DropdownMenu.Item key={key} tone={tone} onSelect={onSelect}>
            <Icon name={icon} />
            {label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
