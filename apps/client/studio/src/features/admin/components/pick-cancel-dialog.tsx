import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, useToast } from '@vp/ui';

import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { useCancelPick } from '#app/features/admin/hooks/use-pick-mutations';
import { usePickWindowText } from '#app/features/admin/hooks/use-pick-window-text';

export interface PickCancelDialogProps {
  pick: AdminPick;
  onClose: () => void;
}

/** Asks before a pick is cancelled, a running one included: home falls back to what is trending. */
export function PickCancelDialog({ pick, onClose }: PickCancelDialogProps) {
  const { tOr } = useT();
  const toast = useToast();
  const cancel = useCancelPick();
  const windowText = usePickWindowText();
  const title = pick.video.title ?? tOr('studio.pickUntitled', {}, '');

  const confirm = async () => {
    const done = await fromPromise(
      () => cancel.mutateAsync(pick.id),
      (cause) => cause
    );
    if (!isOk(done)) {
      toast({ tone: 'danger', title: tOr('studio.pickCancelFailed', {}, '') });
    }
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.pickCancelTitle', {}, '')}</AlertDialog.Title>
        <AlertDialog.Description>
          {tOr('studio.pickCancelDescription', { title, window: windowText(pick) }, '')}
        </AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{tOr('studio.pickCancelKeep', {}, '')}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={confirm}>
              {tOr('studio.pickCancelConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
