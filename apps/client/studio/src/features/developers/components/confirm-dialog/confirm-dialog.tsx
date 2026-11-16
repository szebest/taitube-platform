import { AlertDialog, Button, useUiCopy } from '@vp/ui';

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before something that cannot be undone: revoking a token, removing a webhook. */
export function ConfirmDialog({
  title,
  description,
  confirm,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { cancel } = useUiCopy();

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
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
