import { useT } from '@vp/intl-react';
import { Button, ResponsiveModal, useToast, useUiCopy } from '@vp/ui';
import { useState } from 'react';
import { useClearWatchHistory } from '#app/features/account/hooks/use-clear-watch-history';
import { SettingItem } from '../setting-item/setting-item';

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
      <ResponsiveModal.Root open={open} onOpenChange={setOpen}>
        <ResponsiveModal.Trigger asChild>
          <Button variant="outline" tone="danger">
            {tOr('settings.clearHistoryAction', {}, '')}
          </Button>
        </ResponsiveModal.Trigger>
        <ResponsiveModal.Content>
          <ResponsiveModal.Header>
            <ResponsiveModal.Title>
              {tOr('settings.clearHistoryTitle', {}, '')}
            </ResponsiveModal.Title>
            <ResponsiveModal.Description>
              {tOr('settings.clearHistoryBody', {}, '')}
            </ResponsiveModal.Description>
          </ResponsiveModal.Header>
          <ResponsiveModal.Footer>
            <ResponsiveModal.Close asChild>
              <Button variant="ghost">{cancel}</Button>
            </ResponsiveModal.Close>
            <Button variant="solid" tone="danger" disabled={isPending} onClick={clear}>
              {tOr('settings.clearHistoryAction', {}, '')}
            </Button>
          </ResponsiveModal.Footer>
        </ResponsiveModal.Content>
      </ResponsiveModal.Root>
    </SettingItem>
  );
}
