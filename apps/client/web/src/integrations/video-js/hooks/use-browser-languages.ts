import { readBrowserLanguages } from '@vp/queries';
import { useSyncExternalStore } from 'react';

const NO_LANGUAGES: readonly string[] = [];

const LIST_SEPARATOR = ',';

const subscribeLanguages = (listener: () => void) => {
  window.addEventListener('languagechange', listener);
  return () => window.removeEventListener('languagechange', listener);
};

// A browser may hand back a new array on every read of navigator.languages, so the snapshot is the joined text.
const readJoinedLanguages = () => readBrowserLanguages().join(LIST_SEPARATOR);

/** The browser's languages, most preferred first; none on the server, so nothing picked by them renders there. */
export function useBrowserLanguages(): readonly string[] {
  const joined = useSyncExternalStore(subscribeLanguages, readJoinedLanguages, () => '');

  return joined === '' ? NO_LANGUAGES : joined.split(LIST_SEPARATOR);
}
