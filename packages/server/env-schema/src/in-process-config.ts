import { type AppConfig, toAppConfig } from './app-config';
import { AppEnvSchema } from './app-env';
import { asCdnBase } from './cdn-base';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** `cdn` is taken as a plain string and branded on the way in, so an override cannot skip it. */
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

/**
 * What an in-process app runs on: the in-memory family over the schema defaults, with any
 * overrides merged in `AppConfig`'s own shape. Port 0 lets the OS pick, so two in-process apps
 * never contend for the metrics port.
 */
export function inProcessAppConfig(overrides: AppConfigOverrides = {}): AppConfig {
  const { cdn, ...rest } = overrides;
  const base = toAppConfig(
    AppEnvSchema.parse({
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      METRICS_PORT: 0,
    })
  );

  return merged({ ...base, cdn: cdn === undefined ? base.cdn : asCdnBase(cdn) }, rest);
}
