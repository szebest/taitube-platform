import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@vp/domain/time';

/**
 * Tuning with no environment key of its own, declared once here so no service, stage or adapter holds
 * a default. `toAppConfig` is the only reader; everything else takes the value from `AppConfig`.
 */

/** SDD §10: an idle stream closes after 30 minutes and the client reconnects with Last-Event-ID. */
export const SSE_IDLE_TIMEOUT_MS = 30 * MS_PER_MINUTE;

/** The session outlives its URLs: a 5 GB multipart upload takes far longer than one presigned TTL. */
export const UPLOAD_SESSION_TTL_SECONDS = SECONDS_PER_DAY;

export const JWKS_CACHE_TTL_MS = 5 * MS_PER_MINUTE;

/** An unknown `kid` refetches at most this often, so a flood of forged kids cannot hammer the IdP. */
export const JWKS_REFETCH_INTERVAL_MS = 30 * MS_PER_SECOND;

/** The JWKS fetch runs inside the auth hook, so a hanging IdP would otherwise hang every request. */
export const JWKS_FETCH_TIMEOUT_MS = 5 * MS_PER_SECOND;

export const CACHES = {
  categories: { l1TtlMs: MS_PER_MINUTE, l2TtlSeconds: 5 * SECONDS_PER_MINUTE, maxL1Entries: 100 },
  reactions: { ttlSeconds: SECONDS_PER_HOUR, userReactionTtlSeconds: SECONDS_PER_DAY },
  subscriptions: {
    userSubscriptionsTtlSeconds: SECONDS_PER_DAY,
    subscriberCountTtlSeconds: SECONDS_PER_HOUR,
  },
  comments: { hotTtlSeconds: SECONDS_PER_MINUTE },
} as const;

export const HOUSEKEEPING = {
  outboxRelayIntervalMs: MS_PER_SECOND,
  outboxBatchSize: 50,
  outboxRetentionDays: 7,
  purgeDeletedAfterMs: MS_PER_HOUR,
  stuckProcessingAfterMs: 3 * MS_PER_HOUR,
  stuckUploadingAfterMs: MS_PER_DAY,
  stuckUploadedAfterMs: 5 * MS_PER_MINUTE,
  tmpSweepAfterMs: 2 * MS_PER_HOUR,
  reactionReconcileLimit: 500,
  scanLimit: 100,
} as const;

export const SEGMENT_UPLOAD = {
  concurrency: 4,
  maxRetries: 3,
  retryDelayMs: 150,
  pollIntervalMs: 100,
} as const;

/** 160x90 tiles, ten to a row: the geometry the player's scrub preview reads out of sprite.vtt. */
export const SPRITE_GEOMETRY = { columns: 10, tileWidth: 160, tileHeight: 90 } as const;

export const FFMPEG_PROCESS = {
  killGraceMs: 3 * MS_PER_SECOND,
  stderrTailLines: 50,
  minTranscodeTimeoutMs: 10 * MS_PER_MINUTE,
  thumbnailTimeoutMs: MS_PER_MINUTE,
} as const;

/** `infra/k8s` liveness allows three missed beats, so this sets how fast a hung worker is restarted. */
export const WORKER_HEARTBEAT_INTERVAL_MS = 15 * MS_PER_SECOND;

export const POLLERS = {
  queueIntervalMs: 5 * MS_PER_SECOND,
  sqlIntervalMs: 30 * MS_PER_SECOND,
  staleStepMs: 5 * MS_PER_MINUTE,
} as const;

export const HTTP_CACHE = {
  categories: {
    maxAgeSeconds: 5 * SECONDS_PER_MINUTE,
    staleWhileRevalidateSeconds: SECONDS_PER_MINUTE,
  },
  feed: { maxAgeSeconds: 30, staleWhileRevalidateSeconds: SECONDS_PER_MINUTE },
} as const;
