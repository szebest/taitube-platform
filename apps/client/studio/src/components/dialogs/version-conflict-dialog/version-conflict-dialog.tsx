import { useT } from '@vp/intl-react';
import { Button, ResponsiveModal } from '@vp/ui';

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
    <ResponsiveModal.Root open={open} onOpenChange={onOpenChange}>
      <ResponsiveModal.Content size="sm">
        <ResponsiveModal.Header>
          <ResponsiveModal.Title>{tOr('studio.editConflictTitle', {}, '')}</ResponsiveModal.Title>
          <ResponsiveModal.Description>
            {tOr('studio.editConflictBody', {}, '')}
          </ResponsiveModal.Description>
        </ResponsiveModal.Header>
        <ResponsiveModal.Footer>
          <Button variant="outline" onClick={onReload}>
            {tOr('studio.editConflictReload', {}, '')}
          </Button>
          <Button variant="solid" tone="danger" onClick={onOverwrite}>
            {tOr('studio.editConflictOverwrite', {}, '')}
          </Button>
        </ResponsiveModal.Footer>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
