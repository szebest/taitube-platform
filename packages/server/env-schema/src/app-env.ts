import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import { z } from 'zod';

/**
 * A secret has no default: an unset one is absent, and `AppEnvSchema` refuses a production boot
 * without it. An empty value reads as unset, which is what `KEY=` in a `.env` file means.
 */
const secret = () =>
  z
    .string()
    .optional()
    .transform((value) => value || undefined);

export const SECRET_KEYS = [
  'ADMIN_TOKEN',
  'WEBHOOK_SIGNING_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'REDIS_PASSWORD',
] as const;

/** The placeholder `.env.example` and the k8s base Secret ship, which is public by construction. */
const PLACEHOLDER_SECRET = /^change-me/;

export const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('debug'),
  SERVICE_VERSION: z.string().default('dev'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8080'),
  PORT: z.coerce.number().int().positive().default(3000),
  METRICS_PORT: z.coerce.number().int().positive().default(9464),
  PAGE_SIZE_DEFAULT: z.coerce.number().int().positive().default(PAGE_SIZE_DEFAULT),
  PAGE_SIZE_MAX: z.coerce.number().int().positive().default(PAGE_SIZE_MAX),
  TURBO_TELEMETRY_DISABLED: z.string().default('1'),
  DO_NOT_TRACK: z.string().default('1'),
});

export const PostgresEnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL is required and must be a valid URL' }),
  DATABASE_URL_MIGRATIONS: z.string().url().default('postgres://vp:vp@localhost:5432/vp'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export const RedisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://:vp@localhost:6379/0'),
  REDIS_PUBSUB_URL: z.string().default('redis://:vp@localhost:6379/1'),
  BULLMQ_PREFIX: z.string().default('bull'),
  REDIS_ADDR: z.string().default('redis:6379'),
  REDIS_PASSWORD: secret(),
});

export const StorageEnvSchema = z.object({
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val) => val === 'true'),
  S3_ACCESS_KEY_ID: secret(),
  S3_SECRET_ACCESS_KEY: secret(),
  S3_BUCKET_RAW: z.string().default('raw'),
  S3_BUCKET_PUBLIC: z.string().default('public'),
  S3_PRESIGN_TTL_SEC: z.coerce.number().int().positive().default(900),
  CDN_BASE_URL: z.string().default('http://localhost:9000/public'),
  S3_MULTIPART_THRESHOLD_BYTES: z.coerce.number().int().positive().default(104857600),
  S3_PART_SIZE_MIN_BYTES: z.coerce.number().int().positive().default(8388608),
  S3_PART_SIZE_MAX_BYTES: z.coerce.number().int().positive().default(67108864),
  RAW_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
});

export const AuthEnvSchema = z.object({
  AUTH_JWKS_URL: z.string().default('http://localhost:3000/.well-known/jwks.json'),
  AUTH_ISSUER: z.string().default('vp-dev'),
  AUTH_AUDIENCE: z.string().default('vp-api'),
  AUTH_DEV_USER_ID: z.string().default('00000000-0000-7000-8000-000000000001'),
  ADMIN_TOKEN: secret(),
  WEBHOOK_SIGNING_SECRET: secret(),
  WEBHOOK_URL_ALLOWLIST: z.string().default('').optional(),
});

export const PipelineEnvSchema = z.object({
  WORKER_STAGE: z
    .enum([
      'probe',
      'transcode-1080p',
      'transcode-720p',
      'transcode-480p',
      'thumbnail',
      'package',
      'notify',
      'housekeeping',
    ])
    .default('probe'),
  WORKER_CONCURRENCY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  WORKER_RUNTIME: z.enum(['bun', 'node']).default('bun'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  FFMPEG_THREADS: z.coerce.number().int().positive().default(2),
  X264_PRESET: z.string().default('veryfast'),
  HLS_SEGMENT_SECONDS: z.coerce.number().int().positive().default(6),
  GOP_SECONDS: z.coerce.number().int().positive().default(2),
  TRANSCODE_MODE: z.enum(['per-rendition', 'combined']).default('per-rendition'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(4294967296),
  MAX_DURATION_SEC: z.coerce.number().int().positive().default(3600),
  MAX_INFLIGHT_PER_USER: z.coerce.number().int().positive().default(3),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  ALLOWED_CONTENT_TYPES: z
    .string()
    .default('video/mp4,video/quicktime,video/webm,video/x-matroska'),
  JOB_TIMEOUT_FACTOR: z.coerce.number().int().positive().default(3),
  TMP_DIR: z.string().default('/tmp/vp'),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15000),
  SSE_MAX_PER_USER: z.coerce.number().int().positive().default(20),
  SSE_MAX_PER_POD: z.coerce.number().int().positive().default(5000),
  SPRITE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(5),
  WORKER_HEARTBEAT_PATH: z.string().default('/tmp/vp/heartbeat'),
});

export const OtelEnvSchema = z.object({
  OTEL_SERVICE_NAME: z.string().default('').optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().default('').optional(),
  OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1.0),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default('deployment.environment=local'),
});

export const AppEnvShape = CoreEnvSchema.merge(PostgresEnvSchema)
  .merge(RedisEnvSchema)
  .merge(StorageEnvSchema)
  .merge(AuthEnvSchema)
  .merge(PipelineEnvSchema)
  .merge(OtelEnvSchema);

export const AppEnvSchema = AppEnvShape.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  for (const key of SECRET_KEYS) {
    const value = env[key];
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'is required in production',
      });
    } else if (PLACEHOLDER_SECRET.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'still holds the published placeholder, which is not a credential',
      });
    }
  }
});

export type AppEnv = z.infer<typeof AppEnvSchema>;
