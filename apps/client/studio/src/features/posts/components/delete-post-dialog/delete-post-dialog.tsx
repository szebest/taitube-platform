import { AlertDialog, Button } from '@kit/ui';
import { useT } from '#app/lib/messages';

export interface DeletePostDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before a post goes with its replies, likes and stats. */
export function DeletePostDialog({ onConfirm, onClose }: DeletePostDialogProps) {
  const { tOr } = useT();

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.postsDeleteTitle', {}, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr('studio.postsDeleteBody', {}, '')}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{tOr('ui.cancel', {}, '')}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={onConfirm}>
              {tOr('studio.postsDeleteConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
