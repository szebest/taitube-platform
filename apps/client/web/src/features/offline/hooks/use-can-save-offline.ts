import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () =>
  Reflect.has(window, 'caches') && Reflect.has(navigator, 'serviceWorker');
const serverSnapshot = () => undefined;

/** Whether this browser can keep videos offline: it has CacheStorage and service workers. Unknown, `undefined`, on the server and while hydrating. */
export function useCanSaveOffline(): boolean | undefined {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
