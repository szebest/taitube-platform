import { useFailureToast, type WatchPartySocket } from '@vp/queries';
import { useState } from 'react';
import { PartyQueue } from '#app/components/party/party-queue';
import {
  type PartyQueueEdit,
  usePartyQueueEdits,
} from '#app/features/watch-party/hooks/use-party-queue-edits';
import { useT } from '#app/lib/messages';
import { PartyQueueAddDialog } from './party-queue-add-dialog';

interface PartyQueueTabProps {
  roomId: string;
  socket: WatchPartySocket;
}

/** The Queue tab: the room's queue, with add, remove and reorder where the viewer's ability allows. */
export function PartyQueueTab({ roomId, socket }: PartyQueueTabProps) {
  const { tOr } = useT();
  const edits = usePartyQueueEdits(roomId);
  const showFailure = useFailureToast();
  const [adding, setAdding] = useState(false);
  const { queue, playback, roster } = socket.state;

  const apply = (edit: PartyQueueEdit, onSuccess?: () => void) =>
    edits.mutate(edit, {
      onSuccess,
      onError: (error) =>
        showFailure(
          tOr(edit.type === 'add' ? 'party.queueAddFailed' : 'party.queueEditFailed', {}, ''),
          error
        ),
    });

  return (
    <PartyQueue.Root>
      {queue.items.length === 0 ? (
        <PartyQueue.Empty />
      ) : (
        <PartyQueue.List>
          {queue.items.map((item, index) => (
            <PartyQueue.Item
              key={item.id}
              title={item.video.title ?? ''}
              thumbnailUrl={item.video.thumbnailUrl}
              addedBy={roster.find((person) => person.memberKey === item.addedBy)?.name ?? ''}
              current={item.id === playback.itemId}
              onRemove={() => apply({ type: 'remove', itemId: item.id })}
              onMoveUp={
                index > 0
                  ? () => apply({ type: 'move', itemId: item.id, toIndex: index - 1 })
                  : undefined
              }
              onMoveDown={
                index < queue.items.length - 1
                  ? () => apply({ type: 'move', itemId: item.id, toIndex: index + 1 })
                  : undefined
              }
            />
          ))}
        </PartyQueue.List>
      )}
      <PartyQueue.Add onAdd={() => setAdding(true)} />
      <PartyQueueAddDialog
        open={adding}
        onOpenChange={setAdding}
        onAdd={(videoId) => apply({ type: 'add', videoId }, () => setAdding(false))}
      />
    </PartyQueue.Root>
  );
}
