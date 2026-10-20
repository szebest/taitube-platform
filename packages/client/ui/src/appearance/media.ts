import { useCallback, useSyncExternalStore } from 'react';

export const PREFERS_LIGHT = '(prefers-color-scheme: light)';

export const PREFERS_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** A media query's answer, `false` on the server, where the pre-paint script settles it instead. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      const unsubscribe = () => list.removeEventListener('change', onChange);
      return unsubscribe;
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
