import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';

import { useResolveReport } from '#app/features/admin/hooks/use-report-resolution';

export interface ReportRemoveDialogProps {
  reportId: string;
  /** The start of the comment, so the admin sees which one goes. */
  excerpt: string;
  onClose: () => void;
}

/** Asks before resolving a report as removed, which deletes the comment and its replies. */
export function ReportRemoveDialog({ reportId, excerpt, onClose }: ReportRemoveDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const resolve = useResolveReport();

  const confirm = async () => {
    const done = await fromPromise(
      () => resolve.mutateAsync({ id: reportId, resolution: 'removed' }),
      (cause) => cause
    );
    if (!isOk(done)) {
      toast({ tone: 'danger', title: tOr('studio.adminReportResolveFailed', {}, '') });
    }
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.adminReportRemoveTitle', {}, '')}</AlertDialog.Title>
        <AlertDialog.Description>
          {tOr('studio.adminReportRemoveDescription', { comment: excerpt }, '')}
        </AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={confirm}>
              {tOr('studio.adminReportRemove', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
