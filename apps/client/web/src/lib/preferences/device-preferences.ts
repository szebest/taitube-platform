import { PLAYBACK_SETTINGS, type PlaybackPreferences } from '@vp/domain/settings';
import { isOk, parseJson, tryCatch, unwrapOr } from '@vp/result';
import { ONE_YEAR_S, readCookie, writeCookie } from '@vp/ui';
import { z } from 'zod';
import { COOKIE_MIGRATIONS, migrate, STORAGE_MIGRATIONS, type Stored } from './migrations';

function withFallback<T extends z.ZodType>(schema: T, fallback: z.output<T>) {
  return z
    .unknown()
    .optional()
    .transform((value): z.output<T> => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : fallback;
    });
}

const DEFAULTS = {
  quality: PLAYBACK_SETTINGS.quality.default,
  speed: PLAYBACK_SETTINGS.speed.default,
  autoplayNext: PLAYBACK_SETTINGS.autoplayNext.default,
  hoverPreview: PLAYBACK_SETTINGS.hoverPreview.default,
  hoverPlay: PLAYBACK_SETTINGS.hoverPlay.default,
  captionsOn: PLAYBACK_SETTINGS.captionsOn.default,
  captionsLanguage: PLAYBACK_SETTINGS.captionsLanguage.default,
  captionsSize: PLAYBACK_SETTINGS.captionsSize.default,
  captionsBackground: PLAYBACK_SETTINGS.captionsBackground.default,
  statsOverlay: PLAYBACK_SETTINGS.statsOverlay.default,
} satisfies PlaybackPreferences;

const PlaybackSchema = z.object({
  quality: withFallback(z.literal(PLAYBACK_SETTINGS.quality.options), DEFAULTS.quality),
  speed: withFallback(z.literal(PLAYBACK_SETTINGS.speed.options), DEFAULTS.speed),
  autoplayNext: withFallback(z.boolean(), DEFAULTS.autoplayNext),
  hoverPreview: withFallback(z.boolean(), DEFAULTS.hoverPreview),
  hoverPlay: withFallback(z.boolean(), DEFAULTS.hoverPlay),
  captionsOn: withFallback(z.boolean(), DEFAULTS.captionsOn),
  captionsLanguage: withFallback(z.string().min(2).max(35).nullable(), DEFAULTS.captionsLanguage),
  captionsSize: withFallback(
    z.literal(PLAYBACK_SETTINGS.captionsSize.options),
    DEFAULTS.captionsSize
  ),
  captionsBackground: withFallback(
    z.literal(PLAYBACK_SETTINGS.captionsBackground.options),
    DEFAULTS.captionsBackground
  ),
  statsOverlay: withFallback(z.boolean(), DEFAULTS.statsOverlay),
}) satisfies z.ZodType<PlaybackPreferences>;

const LocaleSchema = withFallback(z.string().min(2).max(35).nullable(), null);

/** What a device holds: the cookie's locale, which the server reads, and the playback fields of `localStorage`. */
export type DevicePreferences = Readonly<{
  schema: number;
  playback: PlaybackPreferences;
  /** `null` follows the browser's languages. */
  locale: string | null;
}>;

const COOKIE_VERSION = COOKIE_MIGRATIONS.length + 1;

const DEFAULT_PLAYBACK: PlaybackPreferences = PlaybackSchema.parse({});

const parsePlayback = (value: unknown): PlaybackPreferences =>
  PlaybackSchema.safeParse(value).data ?? DEFAULT_PLAYBACK;

const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  schema: COOKIE_VERSION,
  playback: DEFAULT_PLAYBACK,
  locale: null,
};

const DEVICE_COOKIE = 'vp.device';

const STORAGE_KEY = 'vp.prefs.device';

const LEGACY_LOCALE_KEY = 'vp.locale';

type CookieRead = Readonly<{
  locale: string | null;
  /** A version 1 cookie's playback fields, which belong in `localStorage` now. */
  legacyPlayback: Stored | undefined;
  stored: Stored;
}>;

function readCookieBackend(): CookieRead {
  const raw = readCookie(DEVICE_COOKIE);
  const { stored } = migrate(
    raw === undefined ? undefined : unwrapOr(parseJson(raw), undefined),
    COOKIE_MIGRATIONS
  );
  const legacy = stored.legacyPlayback;

  return {
    locale: LocaleSchema.parse(stored.locale),
    legacyPlayback: typeof legacy === 'object' && legacy !== null ? (legacy as Stored) : undefined,
    stored,
  };
}

/** What the request's cookie holds: the locale, and the defaults for the playback fields the server cannot see. */
export function requestDevicePreferences(): DevicePreferences {
  const { locale } = readCookieBackend();
  return { ...DEFAULT_DEVICE_PREFERENCES, locale };
}

/** Writes the locale over the cookie as it is now, so another tab's save is not undone from this tab's memory. */
export function saveDeviceLocale(locale: string | null): void {
  const { stored } = readCookieBackend();
  const { legacyPlayback: _handedOver, ...kept } = stored;
  writeCookie(DEVICE_COOKIE, JSON.stringify({ ...kept, locale, schema: COOKIE_VERSION }), {
    maxAge: ONE_YEAR_S,
  });
}

function readStorageRaw(): string | null {
  const read = tryCatch(
    () => window.localStorage.getItem(STORAGE_KEY),
    (cause) => cause
  );
  return isOk(read) ? read.value : null;
}

function readStorageBackend(raw: string | null): Stored {
  const parsed = raw === null ? undefined : unwrapOr(parseJson(raw), undefined);
  return migrate(parsed, STORAGE_MIGRATIONS).stored;
}

/** The playback fields kept on this device, each falling back to its default alone when it is missing or invalid. */
export function readStoredPlayback(raw: string | null = readStorageRaw()): PlaybackPreferences {
  return parsePlayback(readStorageBackend(raw).playback);
}

/** What the server and the hydration pass render in place of the stored playback. */
export const defaultPlayback = (): PlaybackPreferences => DEFAULT_PLAYBACK;

export { readStorageRaw as readStoredPlaybackRaw };

/**
 * The stored document with `patch` merged over what `raw` holds, as JSON, and the playback it carries:
 * the caller reads `raw` just before, so a stale page never overwrites another tab.
 */
export function mergedPlayback(
  raw: string | null,
  patch: Partial<PlaybackPreferences>
): { json: string; playback: PlaybackPreferences } {
  const stored = readStorageBackend(raw);
  const playback = parsePlayback({ ...parsePlayback(stored.playback), ...patch });
  const json = JSON.stringify({ ...stored, schema: STORAGE_MIGRATIONS.length + 1, playback });
  return { json, playback };
}

/** Writes the JSON `mergedPlayback` made; false when the browser refuses. */
export function writeStoredPlayback(json: string): boolean {
  return isOk(
    tryCatch(
      () => window.localStorage.setItem(STORAGE_KEY, json),
      (cause) => cause
    )
  );
}

/** Merges `patch` over what storage holds now and writes it, for a caller with no store of its own. */
/** @internal */
export function saveStoredPlayback(patch: Partial<PlaybackPreferences>): PlaybackPreferences {
  const { json, playback } = mergedPlayback(readStorageRaw(), patch);
  writeStoredPlayback(json);
  return playback;
}

/** Moves the playback fields a version 1 cookie held into storage, once, and rewrites the cookie as version 2. */
export function adoptLegacyPlayback(): PlaybackPreferences | undefined {
  const { legacyPlayback, locale } = readCookieBackend();
  if (legacyPlayback === undefined) return undefined;

  const playback =
    readStorageRaw() === null ? saveStoredPlayback(parsePlayback(legacyPlayback)) : undefined;
  saveDeviceLocale(locale);
  return playback;
}

/** The locale `@vp/intl-react` kept in `localStorage` before the store existed, removed once read. */
export function takeLegacyLocale(): string | undefined {
  const legacy = tryCatch(
    () => {
      const stored = localStorage.getItem(LEGACY_LOCALE_KEY);
      localStorage.removeItem(LEGACY_LOCALE_KEY);
      return stored;
    },
    () => null
  );
  const locale = LocaleSchema.safeParse(unwrapOr(legacy, null));
  return isOk(legacy) ? (locale.data ?? undefined) : undefined;
}

export const STORAGE_PLAYBACK_KEY = STORAGE_KEY;
