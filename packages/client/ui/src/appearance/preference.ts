import type { TokenGroup } from '@vp/design-tokens';
import {
  ACCENT_PATTERN,
  APPEARANCE_SETTINGS,
  type AppearancePreferences,
  DEFAULT_PREFERENCES,
  PREFERENCE_ID_PATTERN,
} from '@vp/domain/settings';
import { parseJson, unwrapOr } from '@vp/result';
import { z } from 'zod';
import { ONE_YEAR_S, readCookie, writeCookie } from '../cookies/cookie';
import type { appearance } from './registry';

type Registry = typeof appearance;

export type TokenSetId<G extends TokenGroup> = Registry['offer'][G][number]['id'];

export type TokenSetIds = Partial<{ readonly [G in TokenGroup]: TokenSetId<G> }>;

const DEFAULTS = DEFAULT_PREFERENCES.appearance;

const anyOther = <T>(fallback: T) => z.unknown().transform((): T => fallback);

const orElse = <T>(schema: z.ZodType<T>, fallback: Exclude<T, undefined>) =>
  z.union([schema, anyOther(fallback)]).default(fallback);

const PreferenceIdSchema = z.string().regex(PREFERENCE_ID_PATTERN);

const storedSet = z.union([PreferenceIdSchema, anyOther(undefined)]).optional();

// Ids are kept whether or not this app offers them: web and studio offer different sets and a
// theme can be registered at runtime, so dropping one here would overwrite it on the next save.
export const AppearancePreferenceSchema = z.object({
  schema: z.literal(2),
  theme: orElse(PreferenceIdSchema.nullable(), DEFAULTS.theme),
  mode: orElse(z.enum(APPEARANCE_SETTINGS.mode.options), DEFAULTS.mode),
  accent: orElse(z.string().regex(ACCENT_PATTERN).nullable(), DEFAULTS.accent),
  contrast: orElse(z.enum(APPEARANCE_SETTINGS.contrast.options), DEFAULTS.contrast),
  overrides: orElse(
    z.object({
      typography: storedSet,
      fontSize: storedSet,
      spacing: storedSet,
      sizing: storedSet,
      radius: storedSet,
      border: storedSet,
      shadow: storedSet,
      ambient: storedSet,
      motion: storedSet,
    } satisfies Record<TokenGroup, z.ZodType>),
    {}
  ),
});

export type AppearancePreference = z.output<typeof AppearancePreferenceSchema>;

export const DEFAULT_APPEARANCE: AppearancePreference = AppearancePreferenceSchema.parse({
  schema: 2,
});

const APPEARANCE_COOKIE = 'vp.appearance';

const LEGACY_THEME_COOKIE = 'vp.theme';

export type StoredAppearance = Readonly<{
  preference: AppearancePreference;
  /** `legacy` is a `vp.theme` cookie from before schema 2, which the caller rewrites once. */
  source: 'appearance' | 'legacy' | 'none';
}>;

const parseStored = (raw: string) =>
  AppearancePreferenceSchema.safeParse(unwrapOr(parseJson(raw), undefined));

export function requestAppearancePreference(): StoredAppearance {
  const stored = readCookie(APPEARANCE_COOKIE);
  const parsed = stored === undefined ? undefined : parseStored(stored);
  if (parsed?.success) {
    return { preference: parsed.data, source: 'appearance' };
  }
  const legacy = readCookie(LEGACY_THEME_COOKIE);
  if (legacy !== undefined) {
    return {
      preference: AppearancePreferenceSchema.parse({ schema: 2, mode: legacy }),
      source: 'legacy',
    };
  }
  return { preference: DEFAULT_APPEARANCE, source: 'none' };
}

export function saveAppearancePreference(preference: AppearancePreference, domain?: string): void {
  writeCookie(APPEARANCE_COOKIE, JSON.stringify(preference), { maxAge: ONE_YEAR_S, domain });
}

/** Rewrites a `vp.theme` read as `source: 'legacy'` as `vp.appearance`, and deletes `vp.theme`. */
export function rewriteLegacyAppearance(preference: AppearancePreference, domain?: string): void {
  saveAppearancePreference(preference, domain);
  writeCookie(LEGACY_THEME_COOKIE, '', { maxAge: 0, domain });
}

/** The account's shape (97's endpoint): no `schema`, which only versions the cookie. */
export function accountAppearance({
  schema: _schema,
  overrides,
  ...axes
}: AppearancePreference): AppearancePreferences {
  return {
    ...axes,
    overrides: Object.fromEntries(
      Object.entries(overrides).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
  };
}
