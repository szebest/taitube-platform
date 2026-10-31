/**
 * A call that failed on the network while a service worker controls the page: the worker's
 * background sync queue holds it and will replay it, so the change is not lost and must stay on
 * screen. An `ApiError` is an answer from the server and is never this.
 */
export function isQueuedByWorker(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    Reflect.has(navigator, 'serviceWorker') &&
    navigator.serviceWorker.controller !== null
  );
}
