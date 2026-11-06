import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const isOnline = () => navigator.onLine;
const serverIsOnline = () => true;

/** `navigator.onLine`, following the browser's online and offline events; the server renders online. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, serverIsOnline);
}
