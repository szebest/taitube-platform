const IMPORT_MESSAGE = /dynamically imported module|importing a module script failed/i;
const preloadFailures = new WeakSet<object>();
let watching = false;

/** Vite reports a failed chunk preload on `window`; its error is a module import failure whatever it says. */
export function watchPreloadErrors(): void {
  if (watching || typeof window === 'undefined') {
    return;
  }
  watching = true;
  window.addEventListener('vite:preloadError', (event) => {
    const { payload } = event as Event & { payload?: unknown };
    if (typeof payload === 'object' && payload !== null) {
      preloadFailures.add(payload);
    }
  });
}

/**
 * Whether `error` is a chunk that could not be loaded: one Vite reported through `vite:preloadError`,
 * or the TypeError a browser throws for a dynamic import, whose wording is the only thing engines differ on.
 */
export function isModuleImportFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (
    preloadFailures.has(error) || (error instanceof TypeError && IMPORT_MESSAGE.test(error.message))
  );
}
