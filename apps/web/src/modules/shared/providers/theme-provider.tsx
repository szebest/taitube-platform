import { type PropsWithChildren, createContext, useContext, useLayoutEffect, useMemo } from "react";
import { z } from "zod";

import { useStoredState } from "#app/hooks/use-stored-state";

const ThemeSchema = z.enum(["light", "dark"]);

type Theme = z.infer<typeof ThemeSchema>;

type ThemeContextValue = {
	theme: Theme;
	changeTheme: (_: Theme) => void;
}

function getUsersPreferredTheme(): Theme {
	if (window.matchMedia) {
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
		return 'light';
	}

	return 'light';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export type ThemeProviderProps = PropsWithChildren;

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
	const [theme, setTheme] = useStoredState('THEME', ThemeSchema, 'light', getUsersPreferredTheme);

	const ctx = useMemo(() => ({
		theme,
		changeTheme: setTheme
	}), [theme, setTheme]);

	useLayoutEffect(() => {
		document.body.dataset.theme = theme;
	}, [theme]);

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