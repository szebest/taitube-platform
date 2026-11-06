import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/** This page's origin in the browser, and an empty string on the server, which has no window to ask. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => ''
  );
}
