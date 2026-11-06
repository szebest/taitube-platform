const IMPORT_MESSAGE = /dynamically imported module|importing a module script failed/i;
const PRELOAD_FAILURE = Symbol.for('vp.preload-failure');

function markPreloadFailure(event: Event): void {
  const { payload } = event as Event & { payload?: unknown };
  if (typeof payload === 'object' && payload !== null) {
    Reflect.set(payload, PRELOAD_FAILURE, true);
  }
}

/** Vite reports a failed chunk preload on `window`; its error is a module import failure whatever it says. */
export function watchPreloadErrors(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', markPreloadFailure);
  }
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
    Reflect.get(error, PRELOAD_FAILURE) === true ||
    (error instanceof TypeError && IMPORT_MESSAGE.test(error.message))
  );
}
