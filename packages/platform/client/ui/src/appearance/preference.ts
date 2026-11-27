import {
  ACCENT_PATTERN,
  CONTRAST_OPTIONS,
  DEFAULT_CONTRAST,
  DEFAULT_MODE,
  MODE_OPTIONS,
  PREFERENCE_ID_PATTERN,
} from '@kit/appearance';
import type { TokenGroup } from '@kit/design-tokens';
import { parseJson, unwrapOr } from '@kit/result';
import { z } from 'zod';
import { ONE_YEAR_S, readCookie, writeCookie } from '../cookies/cookie';
import type { appearance } from './registry';

type Registry = typeof appearance;

export type TokenSetId<G extends TokenGroup> = Registry['offer'][G][number]['id'];

export type TokenSetIds = Partial<{ readonly [G in TokenGroup]: TokenSetId<G> }>;

const anyOther = <T>(fallback: T) => z.unknown().transform((): T => fallback);

const orElse = <T>(schema: z.ZodType<T>, fallback: Exclude<T, undefined>) =>
  z.union([schema, anyOther(fallback)]).default(fallback);

const PreferenceIdSchema = z.string().regex(PREFERENCE_ID_PATTERN);

const AccentSchema = z.string().regex(ACCENT_PATTERN).nullable();

const storedSet = z.union([PreferenceIdSchema, anyOther(undefined)]).optional();

// Ids are kept whether or not this app offers them: apps sharing the cookie offer different sets and
// a theme can be registered at runtime, so dropping one here would overwrite it on the next save.
export const AppearancePreferenceSchema = z.object({
  schema: z.literal(2),
  theme: orElse(PreferenceIdSchema.nullable(), null),
  mode: orElse(z.enum(MODE_OPTIONS), DEFAULT_MODE),
  accent: orElse(AccentSchema, null),
  customGround: orElse(AccentSchema, null),
  customAccent: orElse(AccentSchema, null),
  contrast: orElse(z.enum(CONTRAST_OPTIONS), DEFAULT_CONTRAST),
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

/** The shape an account stores: no `schema`, which only versions the cookie, and only the overrides set. */
export type AccountAppearance = Readonly<
  Omit<AppearancePreference, 'schema' | 'overrides'> & {
    overrides: Readonly<Record<string, string>>;
  }
>;

export const DEFAULT_APPEARANCE: AppearancePreference = AppearancePreferenceSchema.parse({
  schema: 2,
});

/** The cookie names an app keeps its appearance under: both apps of one product share them, so a choice reaches each. */
export type AppearanceStorage = Readonly<{
  /** The cookie that holds the schema 2 preference. */
  cookie: string;
  /** The cookie from before schema 2, which only held the mode. */
  legacyCookie: string;
}>;

export type StoredAppearance = Readonly<{
  preference: AppearancePreference;
  /** `legacy` is the `legacyCookie` from before schema 2, which the caller rewrites once. */
  source: 'appearance' | 'legacy' | 'none';
  storage: AppearanceStorage;
}>;

const parseStored = (raw: string) =>
  AppearancePreferenceSchema.safeParse(unwrapOr(parseJson(raw), undefined));

export function requestAppearancePreference(storage: AppearanceStorage): StoredAppearance {
  const stored = readCookie(storage.cookie);
  const parsed = stored === undefined ? undefined : parseStored(stored);
  if (parsed?.success) {
    return { preference: parsed.data, source: 'appearance', storage };
  }
  const legacy = readCookie(storage.legacyCookie);
  if (legacy !== undefined) {
    return {
      preference: AppearancePreferenceSchema.parse({ schema: 2, mode: legacy }),
      source: 'legacy',
      storage,
    };
  }
  return { preference: DEFAULT_APPEARANCE, source: 'none', storage };
}

export function saveAppearancePreference(
  preference: AppearancePreference,
  { cookie }: AppearanceStorage,
  domain?: string
): void {
  writeCookie(cookie, JSON.stringify(preference), { maxAge: ONE_YEAR_S, domain });
}

/** Rewrites a legacy cookie read as `source: 'legacy'` under the current one, and deletes it. */
export function rewriteLegacyAppearance(
  preference: AppearancePreference,
  storage: AppearanceStorage,
  domain?: string
): void {
  saveAppearancePreference(preference, storage, domain);
  writeCookie(storage.legacyCookie, '', { maxAge: 0, domain });
}

export function accountAppearance({
  schema: _schema,
  overrides,
  ...axes
}: AppearancePreference): AccountAppearance {
  return {
    ...axes,
    overrides: Object.fromEntries(
      Object.entries(overrides).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
  };
}

/** The inverse of `accountAppearance`: an account's saved appearance as the cookie's preference. */
export function appearanceFromAccount(saved: AccountAppearance): AppearancePreference {
  return AppearancePreferenceSchema.parse({ schema: 2, ...saved });
}
