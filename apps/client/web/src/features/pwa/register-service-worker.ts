import { fromPromise, ignore } from '@vp/result';
import { setStaleDeployRecovery } from '@vp/ui';
import { Workbox } from 'workbox-window';
import { reloadWhenIdle } from './reload-when-idle';

const SERVICE_WORKER_URL = '/sw.js';
const WAITING_WORKER_GRACE_MS = 3000;

export type ServiceWorkerOptions = {
  /** Called when a new version waits; `activate` hands it control and reloads once playback is idle. */
  onWaiting: (activate: () => void) => void;
  doc: Document;
  reload: () => void;
};

/**
 * Registers the service worker at the origin root and reports a waiting version. The page reloads
 * only after `activate` was called, never when the very first worker takes control. Returns the
 * cleanup that stops listening.
 */
export function registerServiceWorker({
  onWaiting,
  doc,
  reload,
}: ServiceWorkerOptions): () => void {
  const workbox = new Workbox(SERVICE_WORKER_URL, { scope: '/' });
  let activating = false;

  const handleWaiting = () =>
    onWaiting(() => {
      activating = true;
      workbox.messageSkipWaiting();
    });
  const handleControlling = () => {
    if (activating) {
      reloadWhenIdle(doc, reload);
    }
  };
  const recoverFromStaleDeploy = async () => {
    const registration = await workbox.register();
    const arrived = new Promise<boolean>((resolve) => {
      workbox.addEventListener('waiting', () => resolve(true));
      setTimeout(() => resolve(false), WAITING_WORKER_GRACE_MS);
    });
    await registration?.update();
    if (registration?.waiting || (await arrived)) {
      activating = true;
      workbox.messageSkipWaiting();
      return;
    }
    reload();
  };
  setStaleDeployRecovery(recoverFromStaleDeploy);
  workbox.addEventListener('waiting', handleWaiting);
  workbox.addEventListener('controlling', handleControlling);

  ignore(
    fromPromise(workbox.register(), (cause) => cause),
    'the app works without a service worker, so a failed registration only costs offline support'
  );

  return () => {
    workbox.removeEventListener('waiting', handleWaiting);
    workbox.removeEventListener('controlling', handleControlling);
  };
}
