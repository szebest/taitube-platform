import { PropsWithChildren, createContext, useContext, useLayoutEffect, useMemo } from "react";
import { useLocalStorage } from "@uidotdev/usehooks";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  changeTheme: (_: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export type ThemeProviderProps = PropsWithChildren;

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useLocalStorage<Theme>('THEME', getUsersPreferredTheme());

  const ctx = useMemo(() => ({
    theme,
		changeTheme: (newTheme: Theme) => setTheme(newTheme)
  }), [theme]);

	useLayoutEffect(() => {
		document.body.dataset.theme = theme;
	}, [theme]);

	function getUsersPreferredTheme() {
		if (window.matchMedia) {
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'; 
			else return 'light';
		}

		return 'light';
	}

  return (
    <ThemeContext.Provider value={ctx}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}