import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () =>
  Reflect.has(window, 'caches') && Reflect.has(navigator, 'serviceWorker');
const serverSnapshot = () => false;

/** Whether this browser can keep videos offline: it has CacheStorage and service workers. False on the server. */
export function useCanSaveOffline(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
