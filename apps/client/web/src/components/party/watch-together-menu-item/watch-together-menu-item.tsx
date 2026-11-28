import { DropdownMenu, Icon } from '@kit/ui';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface WatchTogetherMenuItemProps {
  videoId: string;
}

/** "Watch together" for a card's `VideoCard.Menu`: a guest is asked to sign in, an account gets the dialog. */
export function WatchTogetherMenuItem({ videoId }: WatchTogetherMenuItemProps) {
  const { tOr } = useT();
  const { run } = useRequireAccount('party');
  const { open } = urlModals.useUrlModal('watch-together');

  return (
    <DropdownMenu.Item onSelect={() => run(() => open({ videoId }))}>
      <Icon name="party" />
      {tOr('party.watchTogether', {}, '')}
    </DropdownMenu.Item>
  );
}
