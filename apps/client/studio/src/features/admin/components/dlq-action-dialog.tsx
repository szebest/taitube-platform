import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';

import type { DlqEntry } from '#app/features/admin/api/admin-dlq';
import {
  useDiscardDlqEntry,
  useReplayDlqEntry,
} from '#app/features/admin/hooks/use-dlq-mutations';

export type DlqAction = 'replay' | 'discard';

const COPY = {
  replay: {
    title: 'studio.adminDlqReplayTitle',
    description: 'studio.adminDlqReplayDescription',
    confirm: 'studio.adminDlqReplay',
    tone: 'accent',
  },
  discard: {
    title: 'studio.adminDlqDiscardTitle',
    description: 'studio.adminDlqDiscardDescription',
    confirm: 'studio.adminDlqDiscard',
    tone: 'danger',
  },
} as const satisfies Record<DlqAction, Record<string, string>>;

export interface DlqActionDialogProps {
  action: DlqAction;
  entry: DlqEntry;
  onClose: () => void;
}

/** Asks before a dead-letter job goes back on its queue, or is discarded for good; names the job either way. */
export function DlqActionDialog({ action, entry, onClose }: DlqActionDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const replay = useReplayDlqEntry();
  const discard = useDiscardDlqEntry();
  const copy = COPY[action];
  const names = { job: entry.jobId, queue: entry.queue };

  const confirm = async () => {
    const done = await fromPromise(
      () => (action === 'replay' ? replay.mutateAsync(entry.id) : discard.mutateAsync(entry.id)),
      (cause) => cause
    );
    if (!isOk(done)) {
      toast({ tone: 'danger', title: tOr('studio.adminDlqActionFailed', {}, '') });
    }
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr(copy.title, names, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr(copy.description, names, '')}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone={copy.tone} onClick={confirm}>
              {tOr(copy.confirm, {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
