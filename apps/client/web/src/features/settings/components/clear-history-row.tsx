import { useT } from '@vp/intl-react';
import { Button, Dialog, useToast, useUiCopy } from '@vp/ui';
import { useState } from 'react';

import { useClearWatchHistory } from '../hooks/use-clear-watch-history';
import { SettingItem } from './setting-item';

/** Clearing watch history asks first, because the server cannot bring it back. */
export function ClearHistoryRow() {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useClearWatchHistory();

  const clear = () =>
    mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        showToast({ tone: 'success', title: tOr('settings.clearHistoryDone', {}, '') });
      },
      onError: () =>
        showToast({ tone: 'danger', title: tOr('settings.clearHistoryFailed', {}, '') }),
    });

  return (
    <SettingItem
      row="clear-history"
      description={tOr('settings.rowDescription', { row: 'clear-history' }, '')}
    >
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button variant="outline" tone="danger">
            {tOr('settings.clearHistoryAction', {}, '')}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{tOr('settings.clearHistoryTitle', {}, '')}</Dialog.Title>
            <Dialog.Description>{tOr('settings.clearHistoryBody', {}, '')}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{cancel}</Button>
            </Dialog.Close>
            <Button variant="solid" tone="danger" disabled={isPending} onClick={clear}>
              {tOr('settings.clearHistoryAction', {}, '')}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </SettingItem>
  );
}
