import type { TraceSamplerName } from '@vp/observability';
import { assertNever } from '@vp/result';
import type { AppEnv, JWS_ALGORITHMS } from './app-env';
import { type CdnBase, asCdnBase } from './cdn-base';
import {
  CACHES,
  FFMPEG_PROCESS,
  HOUSEKEEPING,
  HTTP_CACHE,
  JWKS_CACHE_TTL_MS,
  JWKS_FETCH_TIMEOUT_MS,
  JWKS_REFETCH_INTERVAL_MS,
  POLLERS,
  SEGMENT_UPLOAD,
  SPRITE_GEOMETRY,
  SSE_IDLE_TIMEOUT_MS,
  UPLOAD_SESSION_TTL_SECONDS,
  VIEWS,
  WORKER_HEARTBEAT_INTERVAL_MS,
} from './tuning';

type AdapterKind = AppEnv['ADAPTER_FAMILY'];

type JwsAlgorithm = (typeof JWS_ALGORITHMS)[number];

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
      fetchTimeoutMs: number;
    }
  | {
      type: 'dev';
      issuer: string;
      audience: string;
      adminToken: string | undefined;
      adminUserId: string;
    };

export interface AppConfig {
  environment: AppEnv['NODE_ENV'];
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
  featureFlags: readonly string[];
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
    sampler: TraceSamplerName;
    samplerArg: number;
    resourceAttributes: string;
  };
  auth: AuthConfig;
  caches: {
    categories: { l1TtlMs: number; l2TtlSeconds: number; maxL1Entries: number };
    reactions: { ttlSeconds: number; userReactionTtlSeconds: number };
    subscriptions: { userSubscriptionsTtlSeconds: number; subscriberCountTtlSeconds: number };
    comments: { hotTtlSeconds: number };
    playheads: { ttlSeconds: number; flushIntervalMs: number };
  };
  pollers: { queueIntervalMs: number; sqlIntervalMs: number; staleStepMs: number };
  httpCache: {
    categories: { maxAgeSeconds: number; staleWhileRevalidateSeconds: number };
    feed: { maxAgeSeconds: number; staleWhileRevalidateSeconds: number };
  };
  housekeeping: {
    outboxRelayIntervalMs: number;
    outboxBatchSize: number;
    outboxRetentionDays: number;
    purgeDeletedAfterMs: number;
    stuckProcessingAfterMs: number;
    stuckUploadingAfterMs: number;
    stuckUploadedAfterMs: number;
    tmpSweepAfterMs: number;
    reactionReconcileLimit: number;
    scanLimit: number;
  };
  views: {
    minWatchSeconds: number;
    dedupTtlSeconds: number;
    fallbackCapacity: number;
    breakerFailureThreshold: number;
    breakerCooldownMs: number;
    flushIntervalMs: number;
    batchRetentionMs: number;
  };
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
    heartbeatIntervalMs: number;
    tmpDir: string;
    ffmpegPath: string;
    ffprobePath: string;
    ffmpegThreads: number;
    x264Preset: string;
    hlsSegmentSeconds: number;
    gopSeconds: number;
    jobTimeoutFactor: number;
    ffmpegProcess: {
      killGraceMs: number;
      stderrTailLines: number;
      minTranscodeTimeoutMs: number;
      thumbnailTimeoutMs: number;
    };
    sprite: { intervalSec: number; columns: number; tileWidth: number; tileHeight: number };
    segmentUpload: {
      concurrency: number;
      maxRetries: number;
      retryDelayMs: number;
      pollIntervalMs: number;
    };
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
        fetchTimeoutMs: JWKS_FETCH_TIMEOUT_MS,
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
    default:
      return assertNever(env.AUTH_MODE, 'AUTH_MODE');
  }
}

export function toAppConfig(env: AppEnv): AppConfig {
  const quiet = env.NODE_ENV === 'test';

  return {
    environment: env.NODE_ENV,
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
    featureFlags: env.FEATURE_FLAGS,
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
    caches: {
      categories: { ...CACHES.categories },
      reactions: { ...CACHES.reactions },
      subscriptions: { ...CACHES.subscriptions },
      comments: { ...CACHES.comments },
      playheads: { ...CACHES.playheads },
    },
    pollers: { ...POLLERS },
    httpCache: {
      categories: { ...HTTP_CACHE.categories },
      feed: { ...HTTP_CACHE.feed },
    },
    housekeeping: { ...HOUSEKEEPING },
    views: { ...VIEWS },
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
      heartbeatIntervalMs: WORKER_HEARTBEAT_INTERVAL_MS,
      tmpDir: env.TMP_DIR,
      ffmpegPath: env.FFMPEG_PATH,
      ffprobePath: env.FFPROBE_PATH,
      ffmpegThreads: env.FFMPEG_THREADS,
      x264Preset: env.X264_PRESET,
      hlsSegmentSeconds: env.HLS_SEGMENT_SECONDS,
      gopSeconds: env.GOP_SECONDS,
      jobTimeoutFactor: env.JOB_TIMEOUT_FACTOR,
      ffmpegProcess: { ...FFMPEG_PROCESS },
      sprite: { intervalSec: env.SPRITE_INTERVAL_SECONDS, ...SPRITE_GEOMETRY },
      segmentUpload: { ...SEGMENT_UPLOAD },
    },
  };
}
