import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { useEffect, useEffectEvent } from 'react';
import { registerServiceWorker } from './register-service-worker';

/**
 * Registers the service worker once the page is live, and toasts "Reload to update" when a new
 * version waits. It renders nothing, runs only in the browser and never in the dev server, whose
 * HMR a worker would break.
 */
export function UpdatePrompt() {
  const { tOr } = useT();
  const showToast = useToast();

  const announce = useEffectEvent((activate: () => void) =>
    showToast({
      title: tOr('pwa.updateTitle', {}, ''),
      action: { label: tOr('pwa.updateAction', {}, ''), onAction: activate },
    })
  );

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
      return;
    }

    const stopRegistration = registerServiceWorker({
      onWaiting: (activate: () => void) => announce(activate),
      doc: document,
      reload: () => window.location.reload(),
    });
    return stopRegistration;
  }, []);

  return null;
}
