import { useSyncExternalStore } from 'react';

import type { Theme } from './theme-preference';

const PREFERS_LIGHT = '(prefers-color-scheme: light)';

export const SYSTEM_THEME_SCRIPT = `document.documentElement.dataset.theme = matchMedia('${PREFERS_LIGHT}').matches ? 'light' : 'dark'`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(PREFERS_LIGHT);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemTheme(): Theme {
  return window.matchMedia(PREFERS_LIGHT).matches ? 'light' : 'dark';
}

export function useSystemTheme(): Theme {
  return useSyncExternalStore(subscribe, systemTheme, () => 'dark');
}
