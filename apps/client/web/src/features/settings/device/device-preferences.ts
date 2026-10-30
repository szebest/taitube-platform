import { PLAYBACK_SETTINGS, type PlaybackPreferences } from '@vp/domain/settings';
import { parseJson, tryCatch, unwrapOr } from '@vp/result';
import { ONE_YEAR_S, readCookie, writeCookie } from '@vp/ui';
import { z } from 'zod';

const DEFAULTS = {
  quality: PLAYBACK_SETTINGS.quality.default,
  speed: PLAYBACK_SETTINGS.speed.default,
  autoplayNext: PLAYBACK_SETTINGS.autoplayNext.default,
  hoverPreview: PLAYBACK_SETTINGS.hoverPreview.default,
  captionsOn: PLAYBACK_SETTINGS.captionsOn.default,
  captionsLanguage: PLAYBACK_SETTINGS.captionsLanguage.default,
  statsOverlay: PLAYBACK_SETTINGS.statsOverlay.default,
} satisfies PlaybackPreferences;

function withFallback<T extends z.ZodType>(schema: T, fallback: z.output<T>) {
  return z
    .unknown()
    .optional()
    .transform((value): z.output<T> => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : fallback;
    });
}

const PlaybackSchema = z.object({
  quality: withFallback(z.literal(PLAYBACK_SETTINGS.quality.options), DEFAULTS.quality),
  speed: withFallback(z.literal(PLAYBACK_SETTINGS.speed.options), DEFAULTS.speed),
  autoplayNext: withFallback(z.boolean(), DEFAULTS.autoplayNext),
  hoverPreview: withFallback(z.boolean(), DEFAULTS.hoverPreview),
  captionsOn: withFallback(z.boolean(), DEFAULTS.captionsOn),
  captionsLanguage: withFallback(z.string().min(2).max(35).nullable(), DEFAULTS.captionsLanguage),
  statsOverlay: withFallback(z.boolean(), DEFAULTS.statsOverlay),
}) satisfies z.ZodType<PlaybackPreferences>;

const DevicePreferencesSchema = z.object({
  schema: z.literal(1),
  playback: withFallback(PlaybackSchema, DEFAULTS),
  /** `null` follows the browser's languages. */
  locale: withFallback(z.string().min(2).max(35).nullable(), null),
});

export type DevicePreferences = z.output<typeof DevicePreferencesSchema>;

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = DevicePreferencesSchema.parse({
  schema: 1,
});

const DEVICE_COOKIE = 'vp.device';

const LEGACY_LOCALE_KEY = 'vp.locale';

/** What the request's cookie holds, or the defaults: read on the server, so the first paint has it. */
export function requestDevicePreferences(): DevicePreferences {
  const stored = readCookie(DEVICE_COOKIE);
  if (stored === undefined) return DEFAULT_DEVICE_PREFERENCES;

  const parsed = DevicePreferencesSchema.safeParse(unwrapOr(parseJson(stored), undefined));
  return parsed.success ? parsed.data : DEFAULT_DEVICE_PREFERENCES;
}

export function saveDevicePreferences(preferences: DevicePreferences): void {
  writeCookie(DEVICE_COOKIE, JSON.stringify(preferences), { maxAge: ONE_YEAR_S });
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
  const locale = DevicePreferencesSchema.shape.locale.safeParse(unwrapOr(legacy, null));
  return locale.data ?? undefined;
}
