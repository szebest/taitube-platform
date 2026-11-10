import { useSyncExternalStore } from 'react';

/** What the root element carries as `data-<name>`, following the viewer changing it: the appearance settings write there. */
export function useRootAttribute(name: string): string | undefined {
  const attribute = `data-${name}`;
  const subscribe = (notify: () => void) => {
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });
    const stopObserving = () => observer.disconnect();
    return stopObserving;
  };

  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute(attribute) ?? undefined,
    () => undefined
  );
}
