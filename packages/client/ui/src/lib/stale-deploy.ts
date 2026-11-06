import { isModuleImportFailure } from './module-import-failure';

const STORAGE_KEY = 'vp:stale-deploy-reloads';

type Recovery = () => void | Promise<void>;

let recover: Recovery = () => window.location.reload();

/** Replaces the plain reload, so an app with a service worker can let a waiting version take over first. */
export function setStaleDeployRecovery(next: Recovery): void {
  recover = next;
}

function fingerprintOf(error: unknown): string {
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? '';
  return `${entry}:${error instanceof Error ? error.message : String(error)}`;
}

function remember(fingerprint: string): boolean {
  try {
    const seen: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    const reloaded = Array.isArray(seen) ? seen : [];
    if (reloaded.includes(fingerprint)) {
      return false;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...reloaded, fingerprint]));
    return true;
  } catch {
    return false;
  }
}

/**
 * A chunk that 404s after a deploy is a page running the old build: run the recovery once for each
 * build and error, and report whether it ran. Without a session that can remember, it does nothing,
 * since a reload that cannot be counted can loop. Browser only.
 */
export function reloadOnceForStaleDeploy(error: unknown): boolean {
  if (typeof window === 'undefined' || !isModuleImportFailure(error)) {
    return false;
  }
  if (!remember(fingerprintOf(error))) {
    return false;
  }
  void recover();
  return true;
}
