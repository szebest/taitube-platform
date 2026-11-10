import { useT } from '@vp/intl-react';
import { Dialog, Kbd } from '@vp/ui';
import { QUEUE_KEYS } from '#app/features/comments/hooks/use-queue-shortcuts';

export interface QueueHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every key of the queue and what it does. */
export function QueueHelpDialog({ open, onOpenChange }: QueueHelpDialogProps) {
  const { tOr } = useT();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.queueHelpTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('studio.queueHelpDescription', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-stack gap-y-inline">
            {QUEUE_KEYS.map((key) => (
              <div key={key} className="contents">
                <dt>
                  <Kbd>{key}</Kbd>
                </dt>
                <dd className="m-0">{tOr('studio.queueKey', { key }, '')}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
