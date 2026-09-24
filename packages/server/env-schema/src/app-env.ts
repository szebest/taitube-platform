import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import { z } from 'zod';
import { heldLocalCredentials } from './local-credentials';

/**
 * A secret has no default: an unset one is absent, and `AppEnvSchema` refuses a production boot
 * without it. An empty value reads as unset, which is what `KEY=` in a `.env` file means.
 */
const secret = () =>
  z
    .string()
    .optional()
    .transform((value) => value || undefined);

const optionalUrl = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional());

const commaList = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
    .pipe(z.array(item));

/** What a production boot cannot start without, and what the cloud overlay's `ExternalSecret` supplies. */
export const SECRET_KEYS = [
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'REDIS_PASSWORD',
] as const;

export const JWS_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
] as const;

const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('debug'),
  SERVICE_VERSION: z.string().default('dev'),
  ADAPTER_FAMILY: z.enum(['external', 'in-memory']).default('external'),
  CORS_ORIGINS: commaList(z.string()).default('http://localhost:5173,http://localhost:8080'),
  TRUST_PROXY: commaList(z.string()).default(''),
  HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  PORT: z.coerce.number().int().nonnegative().default(3000),
  METRICS_PORT: z.coerce.number().int().nonnegative().default(9464),
  PAGE_SIZE_DEFAULT: z.coerce.number().int().positive().default(PAGE_SIZE_DEFAULT),
  PAGE_SIZE_MAX: z.coerce.number().int().positive().default(PAGE_SIZE_MAX),
});

const PostgresEnvSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL is required and must be a valid URL' }),
  DATABASE_URL_MIGRATIONS: optionalUrl(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

const RedisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  REDIS_PUBSUB_URL: z.string().default('redis://localhost:6379/1'),
  BULLMQ_PREFIX: z.string().default('bull'),
  REDIS_PASSWORD: secret(),
});

const StorageEnvSchema = z.object({
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

const AuthEnvSchema = z.object({
  AUTH_MODE: z.enum(['jwks', 'dev']).default('dev'),
  AUTH_JWKS_URL: optionalUrl(),
  AUTH_ISSUER: z.string().default('vp-dev'),
  AUTH_AUDIENCE: z.string().default('vp-api'),
  AUTH_ALGORITHMS: commaList(z.enum(JWS_ALGORITHMS)).default('RS256,ES256'),
  AUTH_DEV_USER_ID: z.string().uuid().default('00000000-0000-7000-8000-000000000001'),
  ADMIN_TOKEN: secret(),
});

const PipelineEnvSchema = z.object({
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
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  FFMPEG_THREADS: z.coerce.number().int().positive().default(2),
  X264_PRESET: z.string().default('veryfast'),
  HLS_SEGMENT_SECONDS: z.coerce.number().int().positive().default(6),
  GOP_SECONDS: z.coerce.number().int().positive().default(2),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(4294967296),
  MAX_DURATION_SEC: z.coerce.number().int().positive().default(3600),
  JOB_TIMEOUT_FACTOR: z.coerce.number().int().positive().default(3),
  MAX_INFLIGHT_PER_USER: z.coerce.number().int().positive().default(3),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  TMP_DIR: z.string().default('/tmp/vp'),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15000),
  SSE_MAX_PER_USER: z.coerce.number().int().positive().default(20),
  SSE_MAX_PER_POD: z.coerce.number().int().positive().default(5000),
  SPRITE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(5),
  WORKER_HEARTBEAT_PATH: z.string().default('/tmp/vp/heartbeat'),
});

const OtelEnvSchema = z.object({
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1.0),
  OTEL_RESOURCE_ATTRIBUTES: z.string().default('deployment.environment=local'),
});

const AppEnvShape = CoreEnvSchema.merge(PostgresEnvSchema)
  .merge(RedisEnvSchema)
  .merge(StorageEnvSchema)
  .merge(AuthEnvSchema)
  .merge(PipelineEnvSchema)
  .merge(OtelEnvSchema);

type ParsedEnv = z.infer<typeof AppEnvShape>;

const URL_KEYS = (Object.keys(AppEnvShape.shape) as (keyof ParsedEnv)[]).filter((key) =>
  /_URL(_|$)/.test(key)
);

function productionIssues(env: ParsedEnv): { key: string; message: string }[] {
  const issues: { key: string; message: string }[] = [];

  for (const key of SECRET_KEYS) {
    if (!env[key]) issues.push({ key, message: 'is required in production' });
  }
  for (const key of new Set([...SECRET_KEYS, ...URL_KEYS])) {
    const value = env[key];
    if (typeof value === 'string' && heldLocalCredentials(value)) {
      issues.push({ key, message: 'holds a credential this repo ships for local use' });
    }
  }
  if (env.AUTH_MODE === 'dev') {
    issues.push({ key: 'AUTH_MODE', message: 'dev verifies the public dev key; use jwks' });
  }
  if (env.ADMIN_TOKEN !== undefined) {
    issues.push({
      key: 'ADMIN_TOKEN',
      message: 'is refused in production: admin comes from a verified token role',
    });
  }
  if (env.CORS_ORIGINS.length === 0 || env.CORS_ORIGINS.includes('*')) {
    issues.push({ key: 'CORS_ORIGINS', message: 'must name the allowed origins in production' });
  }
  return issues;
}

export const AppEnvSchema = AppEnvShape.superRefine((env, ctx) => {
  if (env.AUTH_MODE === 'jwks' && !env.AUTH_JWKS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_JWKS_URL'],
      message: 'is required when AUTH_MODE=jwks',
    });
  }
  if (env.NODE_ENV !== 'production') return;

  for (const { key, message } of productionIssues(env)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
  }
});

export type AppEnv = z.infer<typeof AppEnvSchema>;
