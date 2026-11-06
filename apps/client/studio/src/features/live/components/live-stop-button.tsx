import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { AlertDialog, Button, useToast } from '@vp/ui';

import { useStopLiveStream } from '../hooks/use-stop-live-stream';

export interface LiveStopButtonProps {
  streamId: string;
}

/** Ends the broadcast, after a confirmation that says what the viewers and the recording will see. */
export function LiveStopButton({ streamId }: LiveStopButtonProps) {
  const { tOr } = useT();
  const toast = useToast();
  const failureToast = useFailureToast();
  const stop = useStopLiveStream(streamId);

  const confirm = () =>
    stop.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.liveStopped', {}, '') }),
      onError: (error) => failureToast(tOr('studio.liveNotStopped', {}, ''), error),
    });

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button variant="solid" tone="danger" size="sm" loading={stop.isPending}>
          {tOr('studio.liveStop', {}, '')}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.liveStopTitle', {}, '')}</AlertDialog.Title>
        <AlertDialog.Description>{tOr('studio.liveStopBody', {}, '')}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{tOr('studio.liveStopCancel', {}, '')}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={confirm}>
              {tOr('studio.liveStop', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
