import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const stopObserving = () => observer.disconnect();
  return stopObserving;
}

const isReduced = () => document.documentElement.dataset.motion === 'reduced';

/** Whether the viewer is on the `reduced` motion set, which the root element carries as `data-motion`. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, isReduced, () => false);
}
