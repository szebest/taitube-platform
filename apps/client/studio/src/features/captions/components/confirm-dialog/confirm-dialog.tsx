import { useT } from '@vp/intl-react';
import { AlertDialog, Button } from '@vp/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}

/** A question the creator answers before something of theirs is removed or replaced. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  onConfirm,
}: ConfirmDialogProps) {
  const { tOr } = useT();

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{body}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{tOr('studio.deleteCancel', {}, '')}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={onConfirm}>
              {confirm}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
