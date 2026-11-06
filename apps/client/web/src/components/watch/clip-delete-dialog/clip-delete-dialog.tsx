import { AlertDialog, Button, useUiCopy } from '@vp/ui';
import type { ComponentProps } from 'react';

export interface ClipDeleteDialogProps extends ComponentProps<typeof AlertDialog.Root> {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}

/** The confirmation before a clip goes: the trigger, what is lost and what is not, and the answer; it stays open until its owner closes it. */
export function ClipDeleteDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  ...props
}: ClipDeleteDialogProps) {
  const { cancel } = useUiCopy();

  return (
    <AlertDialog.Root {...props}>
      <AlertDialog.Trigger asChild>
        <Button tone="danger" variant="soft">
          {triggerLabel}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="ghost">{cancel}</Button>
          </AlertDialog.Cancel>
          <Button tone="danger" variant="solid" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
