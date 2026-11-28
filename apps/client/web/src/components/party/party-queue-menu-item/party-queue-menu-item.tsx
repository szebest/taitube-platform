import { DropdownMenu, Icon } from '@kit/ui';
import { useT } from '#app/lib/messages';
import { useAddToPartyQueue } from './hooks/use-add-to-party-queue';
import { useQueueableParty } from './hooks/use-queueable-party';

export interface PartyQueueMenuItemProps {
  videoId: string;
}

/** "Add to party queue" for a card's `VideoCard.Menu`, offered only while the viewer is in an open party where they may add. */
export function PartyQueueMenuItem({ videoId }: PartyQueueMenuItemProps) {
  const { tOr } = useT();
  const party = useQueueableParty();
  const add = useAddToPartyQueue();

  if (!party) {
    return null;
  }

  return (
    <DropdownMenu.Item onSelect={() => add.mutate({ roomId: party.id, videoId })}>
      <Icon name="queue-add" />
      {tOr('party.queueAddItem', {}, '')}
    </DropdownMenu.Item>
  );
}
