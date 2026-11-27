import { Button, Icon } from '@kit/ui';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface PlaylistSelectionBarProps {
  count: number;
  onCancel: () => void;
}

/** While selecting: how many videos are picked, where they can go, and the way out. */
export function PlaylistSelectionBar({ count, onCancel }: PlaylistSelectionBarProps) {
  const { tOr } = useT();
  const transfer = urlModals.useUrlModal('playlist-transfer');
  const merge = urlModals.useUrlModal('playlist-merge');

  return (
    <div
      role="toolbar"
      aria-label={tOr('playlistEdit.selectionLabel', {}, '')}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-inline rounded-card bg-accent-soft p-2"
    >
      <span aria-live="polite" className="me-auto text-label">
        {tOr('playlistEdit.selectedCount', { count }, '')}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={count === 0}
        onClick={() => transfer.open({ transfer: 'move' })}
      >
        <Icon name="playlist" />
        {tOr('playlistEdit.moveTo', {}, '')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={count === 0}
        onClick={() => transfer.open({ transfer: 'copy' })}
      >
        <Icon name="queue-add" />
        {tOr('playlistEdit.copyTo', {}, '')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => merge.open({})}>
        <Icon name="plus" />
        {tOr('playlistEdit.mergeInto', {}, '')}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        <Icon name="close" />
        {tOr('ui.cancel', {}, '')}
      </Button>
    </div>
  );
}
