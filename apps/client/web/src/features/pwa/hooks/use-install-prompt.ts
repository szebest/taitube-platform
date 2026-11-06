import { fromPromise, ignore } from '@vp/result';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useStoredState } from '#app/hooks/use-stored-state';

const DISMISSED_KEY = 'vp.pwa.install-dismissed';

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return typeof Reflect.get(event, 'prompt') === 'function';
}

const SERVER_DISMISSED = true;
const clientDismissed = () => false;

/**
 * The browser's deferred install prompt (`beforeinstallprompt`), and whether to offer it: not on the
 * server, not before the browser offers one, and not after the viewer dismissed it.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent>();
  const [dismissed, setDismissed] = useStoredState(
    DISMISSED_KEY,
    z.boolean(),
    SERVER_DISMISSED,
    clientDismissed
  );

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      if (!isInstallPromptEvent(event)) {
        return;
      }

      event.preventDefault();
      setDeferred(event);
    };
    const handleInstalled = () => setDeferred(undefined);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const stopListening = () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
    return stopListening;
  }, []);

  const install = () => {
    if (deferred === undefined) {
      return;
    }

    setDeferred(undefined);
    ignore(
      fromPromise(deferred.prompt(), (cause) => cause),
      'the browser shows the outcome itself, and fires appinstalled when the viewer accepts'
    );
  };

  return {
    available: deferred !== undefined && !dismissed,
    install,
    dismiss: () => setDismissed(true),
  };
}
