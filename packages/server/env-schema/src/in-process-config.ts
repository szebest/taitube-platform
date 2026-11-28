import { type AppConfig, toAppConfig } from './app-config';
import { AppEnvSchema } from './app-env';
import { asCdnBase } from './cdn-base';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * `cdn` is taken as a plain string and branded on the way in, so an override cannot skip it.
 *
 * @internal
 */
export type AppConfigOverrides = DeepPartial<Omit<AppConfig, 'cdn'>> & { cdn?: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merged<T>(base: T, overrides: unknown): T {
  if (!(isPlainObject(base) && isPlainObject(overrides))) return (overrides ?? base) as T;

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) result[key] = merged(base[key], value);
  }
  return result as T;
}

const IN_PROCESS_GUEST_SALT = 'in-process-guest-salt';
const IN_PROCESS_VIDEO_ACCESS_SECRET = 'in-process-video-access-secret';
const IN_PROCESS_VOICE_KEY = 'in-process-voice-key';
const IN_PROCESS_VOICE_SECRET = 'in-process-voice-secret-0123456789abcdef';

/**
 * What an in-process app runs on: the in-memory family over the schema defaults, with any
 * overrides merged in `AppConfig`'s own shape. Port 0 lets the OS pick, so two in-process apps
 * never contend for the metrics port.
 *
 * @internal
 */
export function inProcessAppConfig(overrides: AppConfigOverrides = {}): AppConfig {
  const { cdn, ...rest } = overrides;
  const base = toAppConfig(
    AppEnvSchema.parse({
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      METRICS_PORT: 0,
      SCREENING_ENABLED: 'false',
    })
  );

  const watchParties = {
    ...base.watchParties,
    guestSalt: base.watchParties.guestSalt ?? IN_PROCESS_GUEST_SALT,
  };

  const videoAccess = { secret: base.videoAccess.secret ?? IN_PROCESS_VIDEO_ACCESS_SECRET };

  const voice = {
    ...base.voice,
    enabled: true,
    apiKey: base.voice.apiKey ?? IN_PROCESS_VOICE_KEY,
    apiSecret: base.voice.apiSecret ?? IN_PROCESS_VOICE_SECRET,
  };

  return merged(
    {
      ...base,
      watchParties,
      videoAccess,
      voice,
      cdn: cdn === undefined ? base.cdn : asCdnBase(cdn),
    },
    rest
  );
}
