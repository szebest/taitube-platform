import { useSyncExternalStore } from 'react';

import { pauseTransitions } from './pause-transitions';
import type { Theme } from './theme-preference';

const PREFERS_LIGHT = '(prefers-color-scheme: light)';

export const SYSTEM_THEME_SCRIPT = `document.documentElement.dataset.theme = matchMedia('${PREFERS_LIGHT}').matches ? 'light' : 'dark'`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PREFERS_LIGHT);
  const swap = () => {
    pauseTransitions();
    onChange();
  };
  query.addEventListener('change', swap);
  return () => query.removeEventListener('change', swap);
}

function systemTheme(): Theme {
  return window.matchMedia(PREFERS_LIGHT).matches ? 'light' : 'dark';
}

export function useSystemTheme(): Theme {
  return useSyncExternalStore(subscribe, systemTheme, () => 'dark');
}
