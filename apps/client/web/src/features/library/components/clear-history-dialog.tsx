import { useT } from '@vp/intl-react';
import { Button, useUiCopy } from '@vp/ui';

import { urlModals } from '#app/features/url-modal/registry';

import { useClearHistory } from '../hooks/use-clear-history';
import { useClearSearches } from '../hooks/use-clear-searches';

const { UrlModal, useUrlModal } = urlModals;

/** `?modal=clear-history&scope=`: asks first, because the server cannot bring a cleared history back. */
export function ClearHistoryDialog() {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const { params, close } = useUrlModal('clear-history');
  const clearHistory = useClearHistory();
  const clearSearches = useClearSearches();

  const scope = params?.scope ?? 'history';
  const confirm = () => {
    const { mutate } = scope === 'history' ? clearHistory : clearSearches;
    mutate();
    close();
  };

  return (
    <UrlModal.Root id="clear-history">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('library.clearTitle', { scope }, '')}</UrlModal.Title>
        <UrlModal.Description>{tOr('library.clearBody', { scope }, '')}</UrlModal.Description>
        <UrlModal.Footer>
          <UrlModal.Close asChild>
            <Button variant="ghost">{cancel}</Button>
          </UrlModal.Close>
          <Button variant="solid" tone="danger" onClick={confirm}>
            {tOr('library.clear', { scope }, '')}
          </Button>
        </UrlModal.Footer>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
