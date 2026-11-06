import { tryCatch } from '@vp/result';
import { isModuleImportFailure } from './module-import-failure';

const STORAGE_KEY = 'vp:stale-deploy-reloads';
const STALE_DEPLOY_EVENT = 'vp:stale-deploy';

/**
 * Takes over from the plain reload when a stale deploy is found, so an app with a service worker can let
 * a waiting version take control first. Returns the function that stops it.
 */
export function onStaleDeploy(recover: () => void | Promise<void>): () => void {
  const handle = (event: Event) => {
    event.preventDefault();
    void recover();
  };
  window.addEventListener(STALE_DEPLOY_EVENT, handle);
  return () => window.removeEventListener(STALE_DEPLOY_EVENT, handle);
}

function fingerprintOf(error: object): string {
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? '';
  return `${entry}:${String(Reflect.get(error, 'message'))}`;
}

function remember(fingerprint: string): boolean {
  const stored = tryCatch(
    () => {
      const seen: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
      const reloaded = Array.isArray(seen) ? seen : [];
      if (reloaded.includes(fingerprint)) {
        return false;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...reloaded, fingerprint]));
      return true;
    },
    () => false
  );
  return stored.ok && stored.value;
}

/**
 * A chunk that 404s after a deploy is a page running the old build: reload it, or hand it to
 * `onStaleDeploy`'s recovery, once for each build and error, and report whether that happened.
 * Without a session that can remember, it does nothing, since a reload that cannot be counted can
 * loop. Browser only.
 */
export function reloadOnceForStaleDeploy(error: unknown): boolean {
  if (typeof window === 'undefined' || !isModuleImportFailure(error) || typeof error !== 'object') {
    return false;
  }
  if (error === null || !remember(fingerprintOf(error))) {
    return false;
  }
  const claimed = !window.dispatchEvent(new Event(STALE_DEPLOY_EVENT, { cancelable: true }));
  if (!claimed) {
    window.location.reload();
  }
  return true;
}
