import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  const unsubscribe = () => document.removeEventListener('fullscreenchange', onChange);
  return unsubscribe;
}

const isFullscreen = () => Boolean(document.fullscreenElement);

const serverRendersChrome = () => false;

/** True while something on the page is fullscreen (the watch stage, a Short), so the shell hides its chrome. */
export function useImmersive(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, serverRendersChrome);
}
