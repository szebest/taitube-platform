import type { ModeOption, Theme, TokenGroup } from '@vp/design-tokens';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { PREFERS_LIGHT, PREFERS_REDUCED_MOTION, useMediaQuery } from './media';
import { pauseTransitions } from './pause-transitions';
import {
  type AppearancePreference,
  requestAppearancePreference,
  rewriteLegacyAppearance,
  type StoredAppearance,
  saveAppearancePreference,
  type TokenSetIds,
} from './preference';
import { type ResolvedAppearance, resolveAppearance } from './resolve';

export type ShownMode = Exclude<ModeOption, 'system'>;

type Axes = Partial<Pick<AppearancePreference, 'theme' | 'mode' | 'accent' | 'contrast'>>;

type AppearanceContextValue = Readonly<{
  preference: AppearancePreference;
  resolved: ResolvedAppearance;
  /** The mode on screen: `system` already answered by the viewer's colour scheme. */
  shownMode: ShownMode;
  update: (axes: Axes) => void;
  /** `id` may name a set this app does not offer; it then resolves as no choice. */
  setOverride: (group: TokenGroup, id: string) => void;
  /** One group, or every group, back to the theme's (or the app's) default. */
  resetOverrides: (group?: TokenGroup) => void;
  /** The sets this app starts on in place of the theme's, as `AppearanceProvider` was given them. */
  appDefaults: TokenSetIds;
}>;

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

export type AppearanceProviderProps = PropsWithChildren<{
  /** What the server read from the request's cookies. */
  stored: StoredAppearance;
  /** The sets this app starts on in place of the theme's (the studio: compact spacing, small sizing). */
  defaults?: TokenSetIds;
  /** Themes `registerTheme` added, which a preference may name. */
  registered?: readonly Theme[];
  /** The `Domain` the cookie is written with, so a choice made on one app reaches the other. */
  cookieDomain?: string;
}>;

const swap = (change: () => void) => {
  if (typeof document.startViewTransition !== 'function') {
    pauseTransitions();
    change();
    return;
  }
  document.startViewTransition(() => flushSync(change));
};

export function AppearanceProvider({
  stored,
  defaults,
  registered,
  cookieDomain,
  children,
}: AppearanceProviderProps) {
  const [preference, setPreference] = useState(stored.preference);
  const prefersLight = useMediaQuery(PREFERS_LIGHT);
  const reducedMotion = useMediaQuery(PREFERS_REDUCED_MOTION);

  useEffect(() => {
    if (stored.source !== 'legacy') {
      return;
    }

    rewriteLegacyAppearance(stored.preference, cookieDomain);
  }, [stored, cookieDomain]);

  const value = useMemo((): AppearanceContextValue => {
    // Built on the cookie as it is now, not on this tab's state: another tab may have saved since,
    // and the swap waits for the view transition, so state lags a change made a moment ago.
    const commit = (change: (current: AppearancePreference) => AppearancePreference) => {
      const saved = requestAppearancePreference();
      const changed = change(saved.source === 'appearance' ? saved.preference : preference);
      saveAppearancePreference(changed, cookieDomain);
      swap(() => setPreference(changed));
    };
    const systemMode: ShownMode = prefersLight ? 'light' : 'dark';
    return {
      preference,
      resolved: resolveAppearance(preference, { defaults, reducedMotion, registered }),
      shownMode: preference.mode === 'system' ? systemMode : preference.mode,
      update: (axes) => commit((current) => ({ ...current, ...axes })),
      setOverride: (group, id) =>
        commit((current) => ({ ...current, overrides: { ...current.overrides, [group]: id } })),
      appDefaults: defaults ?? {},
      resetOverrides: (group) =>
        commit((current) => ({
          ...current,
          overrides: group === undefined ? {} : { ...current.overrides, [group]: undefined },
        })),
    };
  }, [preference, defaults, reducedMotion, registered, prefersLight, cookieDomain]);

  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return context;
}
