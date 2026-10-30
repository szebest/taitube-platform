import type { PlaybackPreferences } from '@vp/domain/settings';
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { usePreferencesSync } from '../components/preferences-sync.context';
import {
  type DevicePreferences,
  saveDevicePreferences,
  takeLegacyLocale,
} from './device-preferences';

type DeviceStore = Readonly<{
  preferences: DevicePreferences;
  setPlayback: (patch: Partial<PlaybackPreferences>) => void;
  replacePlayback: (next: PlaybackPreferences) => void;
  setLocale: (locale: string | null) => void;
}>;

const DeviceStoreContext = createContext<DeviceStore | undefined>(undefined);

export type DevicePreferencesProviderProps = PropsWithChildren<{
  /** What the server read from the request's cookie. */
  initial: DevicePreferences;
}>;

/** The device's preferences from the cookie, applied at once and written back to it on every change. */
export function DevicePreferencesProvider({ initial, children }: DevicePreferencesProviderProps) {
  const [preferences, setPreferences] = useState(initial);
  const current = useRef(initial);

  const actions = useMemo(() => {
    const commit = (next: DevicePreferences) => {
      current.current = next;
      saveDevicePreferences(next);
      setPreferences(next);
    };
    return {
      setPlayback: (patch: Partial<PlaybackPreferences>) =>
        commit({ ...current.current, playback: { ...current.current.playback, ...patch } }),
      replacePlayback: (playback: PlaybackPreferences) => commit({ ...current.current, playback }),
      setLocale: (locale: string | null) => commit({ ...current.current, locale }),
    };
  }, []);

  useEffect(() => {
    const legacy = takeLegacyLocale();
    if (legacy !== undefined && current.current.locale === null) {
      actions.setLocale(legacy);
    }
  }, [actions]);

  const store = useMemo(() => ({ preferences, ...actions }), [preferences, actions]);

  return <DeviceStoreContext value={store}>{children}</DeviceStoreContext>;
}

export function useDevicePreferences(): DeviceStore {
  const store = use(DeviceStoreContext);
  if (store === undefined) {
    throw new Error('useDevicePreferences must be used within DevicePreferencesProvider');
  }
  return store;
}

/** One playback default: on this device at once, and on the viewer's account when signed in. */
export function usePlaybackPreference<K extends keyof PlaybackPreferences>(
  key: K
): readonly [PlaybackPreferences[K], (value: PlaybackPreferences[K]) => void] {
  const { preferences, setPlayback } = useDevicePreferences();
  const { save } = usePreferencesSync();

  const set = (value: PlaybackPreferences[K]) => {
    setPlayback({ [key]: value });
    save({ playback: { [key]: value } });
  };

  return [preferences.playback[key], set];
}
