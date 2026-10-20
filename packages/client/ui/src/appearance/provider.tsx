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
  rewriteLegacyAppearance,
  type StoredAppearance,
  saveAppearancePreference,
  type TokenSetId,
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
  setOverride: <G extends TokenGroup>(group: G, id: TokenSetId<G>) => void;
  /** One group, or every group, back to the theme's (or the app's) default. */
  resetOverrides: (group?: TokenGroup) => void;
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
    const commit = (changed: AppearancePreference) => {
      saveAppearancePreference(changed, cookieDomain);
      swap(() => setPreference(changed));
    };
    const systemMode: ShownMode = prefersLight ? 'light' : 'dark';
    return {
      preference,
      resolved: resolveAppearance(preference, { defaults, reducedMotion, registered }),
      shownMode: preference.mode === 'system' ? systemMode : preference.mode,
      update: (axes) => commit({ ...preference, ...axes }),
      setOverride: (group, id) =>
        commit({ ...preference, overrides: { ...preference.overrides, [group]: id } }),
      resetOverrides: (group) =>
        commit({
          ...preference,
          overrides: group === undefined ? {} : { ...preference.overrides, [group]: undefined },
        }),
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
