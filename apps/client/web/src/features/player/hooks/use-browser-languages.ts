import { readBrowserLanguages } from '@vp/queries';
import { useSyncExternalStore } from 'react';

const NO_LANGUAGES: readonly string[] = [];

const subscribeLanguages = (listener: () => void) => {
  window.addEventListener('languagechange', listener);
  return () => window.removeEventListener('languagechange', listener);
};

/** The browser's languages, most preferred first; none on the server, so nothing picked by them renders there. */
export function useBrowserLanguages(): readonly string[] {
  return useSyncExternalStore(subscribeLanguages, readBrowserLanguages, () => NO_LANGUAGES);
}
