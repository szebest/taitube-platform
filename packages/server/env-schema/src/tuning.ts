/**
 * Tuning with no environment key of its own, declared once here so no service, stage or adapter holds
 * a default. `toAppConfig` is the only reader; everything else takes the value from `AppConfig`.
 */

/** SDD §10: an idle stream closes after 30 minutes and the client reconnects with Last-Event-ID. */
export const SSE_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** The session outlives its URLs: a 5 GB multipart upload takes far longer than one presigned TTL. */
export const UPLOAD_SESSION_TTL_SECONDS = 24 * 60 * 60;

export const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

/** An unknown `kid` refetches at most this often, so a flood of forged kids cannot hammer the IdP. */
export const JWKS_REFETCH_INTERVAL_MS = 30 * 1000;

/** The JWKS fetch runs inside the auth hook, so a hanging IdP would otherwise hang every request. */
export const JWKS_FETCH_TIMEOUT_MS = 5 * 1000;

export const CACHES = {
  categories: { l1TtlMs: 60_000, l2TtlSeconds: 300, maxL1Entries: 100 },
  reactions: { ttlSeconds: 3_600, userReactionTtlSeconds: 86_400 },
  subscriptions: { userSubscriptionsTtlSeconds: 86_400, subscriberCountTtlSeconds: 3_600 },
} as const;

export const HOUSEKEEPING = {
  outboxRelayIntervalMs: 1_000,
  outboxBatchSize: 50,
  outboxRetentionDays: 7,
  purgeDeletedAfterMs: 60 * 60 * 1000,
  stuckProcessingAfterMs: 3 * 60 * 60 * 1000,
  stuckUploadingAfterMs: 24 * 60 * 60 * 1000,
  stuckUploadedAfterMs: 5 * 60 * 1000,
  tmpSweepAfterMs: 2 * 60 * 60 * 1000,
  reactionReconcileLimit: 500,
} as const;

export const SEGMENT_UPLOAD = { concurrency: 4, maxRetries: 3, retryDelayMs: 150 } as const;

/** 160x90 tiles, ten to a row: the geometry the player's scrub preview reads out of sprite.vtt. */
export const SPRITE_GEOMETRY = { columns: 10, tileWidth: 160, tileHeight: 90 } as const;

export const FFMPEG_PROCESS = {
  killGraceMs: 3_000,
  stderrTailLines: 50,
  minTranscodeTimeoutMs: 10 * 60 * 1000,
  thumbnailTimeoutMs: 60_000,
} as const;

/** `infra/k8s` liveness allows three missed beats, so this sets how fast a hung worker is restarted. */
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;

export const POLLERS = {
  queueIntervalMs: 5_000,
  sqlIntervalMs: 30_000,
  staleStepMs: 5 * 60 * 1000,
} as const;

export const HTTP_CACHE = {
  categories: { maxAgeSeconds: 300, staleWhileRevalidateSeconds: 60 },
  feed: { maxAgeSeconds: 30, staleWhileRevalidateSeconds: 60 },
} as const;
