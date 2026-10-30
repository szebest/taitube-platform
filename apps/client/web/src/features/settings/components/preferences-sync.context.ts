import { createContext, use } from 'react';

import type { PreferencesChange } from '../api/preferences-change';

export type PreferencesSyncValue = Readonly<{
  signedIn: boolean;
  /** Sends `change` to the viewer's account, once the changes made around it have settled; a guest's goes nowhere. */
  save: (change: PreferencesChange) => void;
  /** Setting paths (`playback.speed`) whose last save failed. */
  notSaved: ReadonlySet<string>;
}>;

export const PreferencesSyncContext = createContext<PreferencesSyncValue | undefined>(undefined);

export function usePreferencesSync(): PreferencesSyncValue {
  const value = use(PreferencesSyncContext);
  if (value === undefined) {
    throw new Error('usePreferencesSync must be used within PreferencesSync');
  }
  return value;
}

/** Whether the last save of the setting at `path` (`playback.speed`) failed. */
export function useNotSaved(path: string): boolean {
  return usePreferencesSync().notSaved.has(path);
}
