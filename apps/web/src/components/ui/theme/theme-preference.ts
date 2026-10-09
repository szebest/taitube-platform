import { assertNever } from '@vp/result';
import { z } from 'zod';

import { readCookie, writeCookie } from '#app/integrations/cookies/cookie';

const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const THEME_PREFERENCES = ThemePreferenceSchema.options;

export type Theme = Exclude<ThemePreference, 'system'>;

const THEME_COOKIE = 'vp.theme';
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function requestThemePreference(): ThemePreference {
  const stored = ThemePreferenceSchema.safeParse(readCookie(THEME_COOKIE));
  return stored.success ? stored.data : 'system';
}

export function saveThemePreference(preference: ThemePreference): void {
  writeCookie(THEME_COOKIE, preference, { maxAge: ONE_YEAR_S });
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
