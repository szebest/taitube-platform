import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useSystemTheme } from './system-theme';
import {
  type Theme,
  type ThemePreference,
  resolveTheme,
  saveThemePreference,
} from './theme-preference';

type ThemeContextValue = {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export type ThemeProviderProps = PropsWithChildren<{ preference: ThemePreference }>;

export function ThemeProvider({ preference: initialPreference, children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState(initialPreference);
  const systemTheme = useSystemTheme();

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, theme: resolveTheme(preference, systemTheme), setPreference }),
    [preference, systemTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
