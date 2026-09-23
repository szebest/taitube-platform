import { type AppEnv, AppEnvSchema, type JWS_ALGORITHMS } from './app-env';
import { type CdnBase, asCdnBase } from './cdn-base';

export type AdapterKind = AppEnv['ADAPTER_FAMILY'];

export type JwsAlgorithm = (typeof JWS_ALGORITHMS)[number];

/** SDD §10: an idle stream closes after 30 minutes and the client reconnects with Last-Event-ID. */
const SSE_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** The session outlives its URLs: a 5 GB multipart upload takes far longer than one presigned TTL. */
const UPLOAD_SESSION_TTL_SECONDS = 24 * 60 * 60;

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

/** An unknown `kid` refetches at most this often, so a flood of forged kids cannot hammer the IdP. */
const JWKS_REFETCH_INTERVAL_MS = 30 * 1000;

export type WorkerStageName = AppEnv['WORKER_STAGE'];

export type AuthConfig =
  | {
      type: 'jwks';
      jwksUrl: string;
      issuer: string;
      audience: string;
      algorithms: readonly JwsAlgorithm[];
      cacheTtlMs: number;
      refetchIntervalMs: number;
    }
  | {
      type: 'dev';
      issuer: string;
      audience: string;
      adminToken: string | undefined;
      adminUserId: string;
    };

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
    partSizeMinBytes: number;
    partSizeMaxBytes: number;
    presignTtlSeconds: number;
    uploadSessionTtlSeconds: number;
    rawRetentionDays: number;
    maxDurationSeconds: number;
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
  redis: { url: string; pubsubUrl: string; password: string | undefined; bullmqPrefix: string };
  postgres: { url: string; migrationsUrl: string; poolMax: number };
  otel: {
    enabled: boolean;
    serviceVersion: string;
    endpoint: string;
    sampler: string;
    samplerArg: number;
    resourceAttributes: string;
  };
  auth: AuthConfig;
  http: {
    port: number;
    metricsPort: number;
    corsOrigins: readonly string[];
    trustProxy: readonly string[];
    bodyLimitBytes: number;
  };
  worker: {
    stage: WorkerStageName;
    concurrency: number | undefined;
    heartbeatPath: string;
    tmpDir: string;
    ffmpegPath: string;
    ffprobePath: string;
    ffmpegThreads: number;
    x264Preset: string;
    hlsSegmentSeconds: number;
    gopSeconds: number;
    spriteIntervalSeconds: number;
  };
}

function authConfig(env: AppEnv): AuthConfig {
  switch (env.AUTH_MODE) {
    case 'jwks': {
      if (!env.AUTH_JWKS_URL) throw new Error('AUTH_JWKS_URL is required when AUTH_MODE=jwks');
      return {
        type: 'jwks',
        jwksUrl: env.AUTH_JWKS_URL,
        issuer: env.AUTH_ISSUER,
        audience: env.AUTH_AUDIENCE,
        algorithms: env.AUTH_ALGORITHMS,
        cacheTtlMs: JWKS_CACHE_TTL_MS,
        refetchIntervalMs: JWKS_REFETCH_INTERVAL_MS,
      };
    }
    case 'dev':
      return {
        type: 'dev',
        issuer: env.AUTH_ISSUER,
        audience: env.AUTH_AUDIENCE,
        adminToken: env.ADMIN_TOKEN,
        adminUserId: env.AUTH_DEV_USER_ID,
      };
  }
}

export function toAppConfig(env: AppEnv): AppConfig {
  const quiet = env.NODE_ENV === 'test';

  return {
    kind: env.ADAPTER_FAMILY,
    logLevel: quiet ? 'silent' : env.LOG_LEVEL,
    cdn: asCdnBase(env.CDN_BASE_URL),
    buckets: { raw: env.S3_BUCKET_RAW, public: env.S3_BUCKET_PUBLIC },
    limits: {
      maxUploadBytes: env.MAX_UPLOAD_BYTES,
      maxInflightPerUser: env.MAX_INFLIGHT_PER_USER,
      uploadRateLimitMax: env.UPLOAD_RATE_LIMIT_MAX,
      multipartThresholdBytes: env.S3_MULTIPART_THRESHOLD_BYTES,
      partSizeMinBytes: env.S3_PART_SIZE_MIN_BYTES,
      partSizeMaxBytes: env.S3_PART_SIZE_MAX_BYTES,
      presignTtlSeconds: env.S3_PRESIGN_TTL_SEC,
      uploadSessionTtlSeconds: UPLOAD_SESSION_TTL_SECONDS,
      rawRetentionDays: env.RAW_RETENTION_DAYS,
      maxDurationSeconds: env.MAX_DURATION_SEC,
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
    redis: {
      url: env.REDIS_URL,
      pubsubUrl: env.REDIS_PUBSUB_URL,
      password: env.REDIS_PASSWORD,
      bullmqPrefix: env.BULLMQ_PREFIX,
    },
    postgres: {
      url: env.DATABASE_URL,
      migrationsUrl: env.DATABASE_URL_MIGRATIONS ?? env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX,
    },
    otel: {
      enabled: !quiet,
      serviceVersion: env.SERVICE_VERSION,
      endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      sampler: env.OTEL_TRACES_SAMPLER,
      samplerArg: env.OTEL_TRACES_SAMPLER_ARG,
      resourceAttributes: env.OTEL_RESOURCE_ATTRIBUTES,
    },
    auth: authConfig(env),
    http: {
      port: env.PORT,
      metricsPort: env.METRICS_PORT,
      corsOrigins: env.CORS_ORIGINS,
      trustProxy: env.TRUST_PROXY,
      bodyLimitBytes: env.HTTP_BODY_LIMIT_BYTES,
    },
    worker: {
      stage: env.WORKER_STAGE,
      concurrency: env.WORKER_CONCURRENCY,
      heartbeatPath: env.WORKER_HEARTBEAT_PATH,
      tmpDir: env.TMP_DIR,
      ffmpegPath: env.FFMPEG_PATH,
      ffprobePath: env.FFPROBE_PATH,
      ffmpegThreads: env.FFMPEG_THREADS,
      x264Preset: env.X264_PRESET,
      hlsSegmentSeconds: env.HLS_SEGMENT_SECONDS,
      gopSeconds: env.GOP_SECONDS,
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
    AppEnvSchema.parse({
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
    })
  );

  return merged({ ...base, cdn: cdn === undefined ? base.cdn : asCdnBase(cdn) }, rest);
}
