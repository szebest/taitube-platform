import { assertNever } from '@vp/result';
import { z } from 'zod';

import { ONE_YEAR_S, readCookie, writeCookie } from '../cookies/cookie';

const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const THEME_PREFERENCES = ThemePreferenceSchema.options;

const ThemeSchema = ThemePreferenceSchema.exclude(['system']);

export type Theme = z.infer<typeof ThemeSchema>;

export const THEMES = ThemeSchema.options;

const THEME_COOKIE = 'vp.theme';

export function requestThemePreference(): ThemePreference {
  const stored = ThemePreferenceSchema.safeParse(readCookie(THEME_COOKIE));
  return stored.success ? stored.data : 'system';
}

export function saveThemePreference(preference: ThemePreference, domain?: string): void {
  writeCookie(THEME_COOKIE, preference, { maxAge: ONE_YEAR_S, domain });
}

export function resolveTheme(preference: ThemePreference, system: Theme): Theme {
  switch (preference) {
    case 'dark':
    case 'light':
      return preference;
    case 'system':
      return system;
    default:
      return assertNever(preference, 'theme preference');
  }
}
