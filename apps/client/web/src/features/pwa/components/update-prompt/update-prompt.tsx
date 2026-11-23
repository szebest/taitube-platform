import { useToast } from '@kit/ui';
import { useEffect, useEffectEvent } from 'react';
import { registerServiceWorker } from '#app/integrations/service-worker-client/register-service-worker';
import { useT } from '#app/lib/messages';

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
    if (import.meta.env.DEV || !Reflect.has(navigator, 'serviceWorker')) {
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
