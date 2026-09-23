import { type AppEnv, AppEnvSchema } from './app-env';
import { type CdnBase, asCdnBase } from './cdn-base';

export type AdapterKind = 'in-memory' | 'external';

/** SDD §10: an idle stream closes after 30 minutes and the client reconnects with Last-Event-ID. */
const SSE_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export type WorkerStageName = AppEnv['WORKER_STAGE'];

export interface AppConfig {
  kind: AdapterKind;
  logLevel: string;
  cdn: CdnBase;
  buckets: { raw: string; public: string };
  limits: {
    maxUploadBytes: number;
    maxInflightPerUser: number;
    uploadRateLimitMax: number;
    multipartThresholdBytes: number;
    presignTtlSeconds: number;
    rawRetentionDays: number;
  };
  pagination: { defaultLimit: number; maxLimit: number };
  sse: { heartbeatMs: number; maxPerUser: number; maxPerPod: number; idleTimeoutMs: number };
  s3: {
    endpoint: string;
    region: string;
    forcePathStyle: boolean;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
  };
  redis: { url: string; pubsubUrl: string; password: string | undefined };
  postgres: { url: string; migrationsUrl: string; poolMax: number };
  otel: {
    enabled: boolean;
    serviceVersion: string;
    endpoint: string;
    sampler: string;
    samplerArg: number;
    resourceAttributes: string;
  };
  auth: { jwksUrl: string; adminToken: string | undefined; devTokens: boolean };
  http: { port: number; metricsPort: number };
  worker: {
    stage: WorkerStageName;
    concurrency: number | undefined;
    heartbeatPath: string;
    tmpDir: string;
    ffmpegThreads: number;
    x264Preset: string;
    spriteIntervalSeconds: number;
  };
}

export function toAppConfig(env: AppEnv): AppConfig {
  const inMemory = env.NODE_ENV === 'test';

  return {
    kind: inMemory ? 'in-memory' : 'external',
    logLevel: inMemory ? 'silent' : env.LOG_LEVEL,
    cdn: asCdnBase(env.CDN_BASE_URL),
    buckets: { raw: env.S3_BUCKET_RAW, public: env.S3_BUCKET_PUBLIC },
    limits: {
      maxUploadBytes: env.MAX_UPLOAD_BYTES,
      maxInflightPerUser: env.MAX_INFLIGHT_PER_USER,
      uploadRateLimitMax: env.UPLOAD_RATE_LIMIT_MAX,
      multipartThresholdBytes: env.S3_MULTIPART_THRESHOLD_BYTES,
      presignTtlSeconds: env.S3_PRESIGN_TTL_SEC,
      rawRetentionDays: env.RAW_RETENTION_DAYS,
    },
    pagination: { defaultLimit: env.PAGE_SIZE_DEFAULT, maxLimit: env.PAGE_SIZE_MAX },
    sse: {
      heartbeatMs: env.SSE_HEARTBEAT_MS,
      maxPerUser: env.SSE_MAX_PER_USER,
      maxPerPod: env.SSE_MAX_PER_POD,
      idleTimeoutMs: SSE_IDLE_TIMEOUT_MS,
    },
    s3: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    redis: { url: env.REDIS_URL, pubsubUrl: env.REDIS_PUBSUB_URL, password: env.REDIS_PASSWORD },
    postgres: {
      url: env.DATABASE_URL,
      migrationsUrl: env.DATABASE_URL_MIGRATIONS,
      poolMax: env.DATABASE_POOL_MAX,
    },
    otel: {
      enabled: !inMemory,
      serviceVersion: env.SERVICE_VERSION,
      endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      sampler: env.OTEL_TRACES_SAMPLER,
      samplerArg: env.OTEL_TRACES_SAMPLER_ARG,
      resourceAttributes: env.OTEL_RESOURCE_ATTRIBUTES,
    },
    auth: {
      jwksUrl: env.AUTH_JWKS_URL,
      adminToken: env.ADMIN_TOKEN,
      devTokens: env.NODE_ENV !== 'production',
    },
    http: { port: env.PORT, metricsPort: env.METRICS_PORT },
    worker: {
      stage: env.WORKER_STAGE,
      concurrency: env.WORKER_CONCURRENCY,
      heartbeatPath: env.WORKER_HEARTBEAT_PATH,
      tmpDir: env.TMP_DIR,
      ffmpegThreads: env.FFMPEG_THREADS,
      x264Preset: env.X264_PRESET,
      spriteIntervalSeconds: env.SPRITE_INTERVAL_SECONDS,
    },
  };
}

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
 * overrides merged in `AppConfig`'s own shape.
 */
export function inProcessAppConfig(overrides: AppConfigOverrides = {}): AppConfig {
  const { cdn, ...rest } = overrides;
  const base = toAppConfig(
    AppEnvSchema.parse({ NODE_ENV: 'test', DATABASE_URL: 'postgres://vp:vp@localhost:5432/vp' })
  );

  return merged({ ...base, cdn: cdn === undefined ? base.cdn : asCdnBase(cdn) }, rest);
}
