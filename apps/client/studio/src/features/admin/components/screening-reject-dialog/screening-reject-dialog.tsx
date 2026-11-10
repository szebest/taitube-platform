import { useT } from '@vp/intl-react';
import { Button, Dialog, Field, Textarea, useUiCopy } from '@vp/ui';
import { useState } from 'react';
import { useScreeningDecision } from '#app/features/admin/hooks/use-screening-decision';

const REASON_MAX_LENGTH = 500;

export interface ScreeningRejectDialogProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

/** Asks for the reason a held video is rejected, which the creator reads; the button stays off until there is one. */
export function ScreeningRejectDialog({ videoId, title, onClose }: ScreeningRejectDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const decide = useScreeningDecision();
  const [reason, setReason] = useState('');

  const submit = () =>
    decide.mutate({ kind: 'reject', videoId, reason: reason.trim() }, { onSuccess: onClose });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>{tOr('studio.screeningRejectTitle', { title }, '')}</Dialog.Title>
            <Dialog.Description>
              {tOr('studio.screeningRejectDescription', {}, '')}
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <Field.Root>
              <Field.Label>{tOr('studio.screeningRejectReason', {}, '')}</Field.Label>
              <Textarea
                value={reason}
                maxLength={REASON_MAX_LENGTH}
                onChange={(event) => setReason(event.target.value)}
              />
              <Field.Hint>{tOr('studio.screeningRejectReasonHint', {}, '')}</Field.Hint>
            </Field.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="outline">{cancel}</Button>
            </Dialog.Close>
            <Button
              type="submit"
              variant="solid"
              tone="danger"
              disabled={reason.trim() === ''}
              loading={decide.isPending}
            >
              {tOr('studio.screeningReject', {}, '')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
