import { z } from 'zod';

export const PostgresEnvSchema = z.object({
  DATABASE_URL: z.string().url().default('postgres://vp:vp@localhost:5432/vp'),
  DATABASE_URL_MIGRATIONS: z.string().url().default('postgres://vp:vp@localhost:5432/vp'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export const RedisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://:vp@localhost:6379/0'),
  REDIS_PUBSUB_URL: z.string().default('redis://:vp@localhost:6379/1'),
  BULLMQ_PREFIX: z.string().default('bull'),
  REDIS_ADDR: z.string().default('redis:6379'),
  REDIS_PASSWORD: z.string().default('vp'),
});

export const StorageEnvSchema = z.object({
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val) => val === 'true'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET_RAW: z.string().default('raw'),
  S3_BUCKET_PUBLIC: z.string().default('public'),
  S3_PRESIGN_TTL_SEC: z.coerce.number().int().positive().default(900),
  CDN_BASE_URL: z.string().default('http://localhost:9000/public'),
  S3_MULTIPART_THRESHOLD_BYTES: z.coerce.number().int().positive().default(104857600),
  S3_PART_SIZE_MIN_BYTES: z.coerce.number().int().positive().default(8388608),
  S3_PART_SIZE_MAX_BYTES: z.coerce.number().int().positive().default(67108864),
  RAW_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
});

export const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('debug'),
  SERVICE_VERSION: z.string().default('dev'),
  PORT: z.coerce.number().int().positive().default(3000),
  METRICS_PORT: z.coerce.number().int().positive().default(9464),
  TURBO_TELEMETRY_DISABLED: z.string().default('1'),
  DO_NOT_TRACK: z.string().default('1'),
});

export const OtelEnvSchema = z.object({
  OTEL_SERVICE_NAME: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
});

export const AppEnvSchema = CoreEnvSchema.merge(PostgresEnvSchema)
  .merge(RedisEnvSchema)
  .merge(StorageEnvSchema)
  .merge(OtelEnvSchema);

export type AppEnv = z.infer<typeof AppEnvSchema>;

export function loadEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): AppEnv {
  return AppEnvSchema.parse(env);
}
