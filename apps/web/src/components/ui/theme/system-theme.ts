import { useCallback, useSyncExternalStore } from 'react';

import { pauseTransitions } from './pause-transitions';
import type { Theme } from './theme-preference';

const PREFERS_LIGHT = '(prefers-color-scheme: light)';

export const SYSTEM_THEME_SCRIPT = `document.documentElement.dataset.theme = matchMedia('${PREFERS_LIGHT}').matches ? 'light' : 'dark'`;

function systemTheme(): Theme {
  return window.matchMedia(PREFERS_LIGHT).matches ? 'light' : 'dark';
}

/** `shown` says the page wears the system theme, so a change swaps every colour at once. */
export function useSystemTheme(shown: boolean): Theme {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const query = window.matchMedia(PREFERS_LIGHT);
      const swap = () => {
        if (shown) pauseTransitions();
        onChange();
      };
      query.addEventListener('change', swap);
      return () => query.removeEventListener('change', swap);
    },
    [shown]
  );

  return useSyncExternalStore(subscribe, systemTheme, () => 'dark');
}
