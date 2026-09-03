import { z } from 'zod';

export const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('debug'),
  SERVICE_VERSION: z.string().default('dev'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8080'),
  PORT: z.coerce.number().int().positive().default(3000),
  METRICS_PORT: z.coerce.number().int().positive().default(9464),
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

export const AuthEnvSchema = z.object({
  AUTH_JWKS_URL: z.string().default('http://localhost:3000/.well-known/jwks.json'),
  AUTH_ISSUER: z.string().default('vp-dev'),
  AUTH_AUDIENCE: z.string().default('vp-api'),
  AUTH_DEV_USER_ID: z.string().default('00000000-0000-7000-8000-000000000001'),
  ADMIN_TOKEN: z.string().default('change-me-32-bytes-random'),
  WEBHOOK_SIGNING_SECRET: z.string().default('change-me-32-bytes-random'),
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
  WORKER_CONCURRENCY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number.parseInt(val, 10) : undefined)),
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
  ALLOWED_CONTENT_TYPES: z
    .string()
    .default('video/mp4,video/quicktime,video/webm,video/x-matroska'),
  JOB_TIMEOUT_FACTOR: z.coerce.number().int().positive().default(3),
  TMP_DIR: z.string().default('/tmp/vp'),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15000),
  SSE_MAX_PER_USER: z.coerce.number().int().positive().default(20),
  SSE_MAX_PER_POD: z.coerce.number().int().positive().default(5000),
});

export const OtelEnvSchema = z.object({
  OTEL_SERVICE_NAME: z.string().default('').optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().default('').optional(),
  OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1.0),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default('deployment.environment=local'),
});

export const AppEnvSchema = CoreEnvSchema.merge(PostgresEnvSchema)
  .merge(RedisEnvSchema)
  .merge(StorageEnvSchema)
  .merge(AuthEnvSchema)
  .merge(PipelineEnvSchema)
  .merge(OtelEnvSchema);

export type AppEnv = z.infer<typeof AppEnvSchema>;

export const SECRET_KEY_PATTERN = /password|secret|key|token|auth/i;

export function redactValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '[NOT_SET]';
  if (SECRET_KEY_PATTERN.test(key)) return '[REDACTED]';
  return String(value);
}

export function loadEnv(
  env?: Record<string, string | undefined>,
  options: { exitOnError?: boolean } = { exitOnError: true }
): AppEnv {
  const envToParse = env ?? (typeof process !== 'undefined' ? process.env : {});
  const result = AppEnvSchema.safeParse(envToParse);

  if (!result.success) {
    const errorLines: string[] = [];
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      const isSecret = SECRET_KEY_PATTERN.test(key) || /url/i.test(key);
      errorLines.push(
        `  - ${key}: ${issue.message}${isSecret ? ' (sensitive key - details redacted)' : ''}`
      );
    }
    const message = `[FATAL] Invalid environment configuration:\n${errorLines.join('\n')}`;
    if (typeof console !== 'undefined' && console.error) {
      console.error(message);
    }
    if (options.exitOnError && typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
    throw new Error(message);
  }

  return result.data;
}
