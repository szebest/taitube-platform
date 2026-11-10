import type { PlaybackPreferences } from '@vp/domain/settings';
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  adoptLegacyPlayback,
  type DevicePreferences,
  requestDevicePreferences,
  saveDeviceLocale,
  takeLegacyLocale,
} from './device-preferences';
import { PlaybackStore } from './playback-store';
import { usePreferencesSync } from './preferences-sync.context';
import { postPref, subscribePrefs } from './prefs-channel';

type DeviceStore = Readonly<{
  preferences: DevicePreferences;
  setPlayback: (patch: Partial<PlaybackPreferences>) => void;
  replacePlayback: (next: PlaybackPreferences) => void;
  setLocale: (locale: string | null) => void;
}>;

const DeviceStoreContext = createContext<DeviceStore | undefined>(undefined);

export type DevicePreferencesProviderProps = PropsWithChildren<{
  /** What the server read from the request's cookie: the locale, and the defaults for the fields only the page can read. */
  initial: DevicePreferences;
}>;

/**
 * The device's preferences. The locale comes from the cookie the server read; the playback fields are
 * in `localStorage`, so they render as their defaults on the server and the hydration pass and take
 * the stored values once mounted. Every write merges over what is stored now and tells the other tabs.
 */
export function DevicePreferencesProvider({ initial, children }: DevicePreferencesProviderProps) {
  const [locale, setLocaleState] = useState(initial.locale);
  const [playbackStore] = useState(() => new PlaybackStore());
  const playback = useSyncExternalStore(
    playbackStore.subscribe,
    playbackStore.snapshot,
    playbackStore.serverSnapshot
  );

  const writePlayback = (patch: Partial<PlaybackPreferences>) => {
    const next = playbackStore.save(patch);
    for (const key of Object.keys(patch) as (keyof PlaybackPreferences)[]) {
      postPref({ field: `playback.${key}`, value: next[key] });
    }
  };
  const actions = {
    setPlayback: writePlayback,
    replacePlayback: writePlayback,
    setLocale: (next: string | null) => {
      saveDeviceLocale(next);
      setLocaleState(next);
      postPref({ field: 'locale', value: next });
    },
  };

  const store = { preferences: { ...initial, playback, locale }, ...actions };

  const settle = useEffectEvent(() => {
    adoptLegacyPlayback();
    playbackStore.refresh();
    const legacy = takeLegacyLocale();
    if (legacy !== undefined && requestDevicePreferences().locale === null) {
      actions.setLocale(legacy);
    }
  });
  const hear = useEffectEvent(({ field }: { field: string }) => {
    if (field === 'locale') {
      setLocaleState(requestDevicePreferences().locale);
    } else if (field.startsWith('playback')) {
      playbackStore.refresh();
    }
  });

  useEffect(() => settle(), []);
  useEffect(() => subscribePrefs(hear), []);

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

/** The language chosen on this device, `null` while the browser's languages decide; the account holds none. */
export function useLocalePreference(): readonly [string | null, (locale: string | null) => void] {
  const { preferences, setLocale } = useDevicePreferences();

  return [preferences.locale, setLocale];
}
