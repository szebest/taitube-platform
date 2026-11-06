import { useT } from '@vp/intl-react';
import { Button, Dialog } from '@vp/ui';

export interface VersionConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onOverwrite: () => void;
}

/** Shown when the API refuses an edit made against a stale version: the creator picks, nothing fails silently. */
export function VersionConflictDialog({
  open,
  onOpenChange,
  onReload,
  onOverwrite,
}: VersionConflictDialogProps) {
  const { tOr } = useT();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.editConflictTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('studio.editConflictBody', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="outline" onClick={onReload}>
            {tOr('studio.editConflictReload', {}, '')}
          </Button>
          <Button variant="solid" tone="danger" onClick={onOverwrite}>
            {tOr('studio.editConflictOverwrite', {}, '')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
