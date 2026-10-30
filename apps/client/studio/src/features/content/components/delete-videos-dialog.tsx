import { useT } from '@vp/intl-react';
import { AlertDialog, Button } from '@vp/ui';

export interface DeleteVideosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
}

export function DeleteVideosDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: DeleteVideosDialogProps) {
  const { tOr } = useT();

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.deleteConfirmTitle', { count }, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr('studio.deleteConfirmBody', {}, '')}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{tOr('studio.deleteCancel', {}, '')}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={onConfirm}>
              {tOr('studio.deleteConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
