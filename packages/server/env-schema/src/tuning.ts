import { NOTIFICATION_RETENTION_DAYS, type ScreeningThresholds } from '@vp/domain';
import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@vp/domain/time';
import type { ScreeningModelTuning, ScreeningProcessTuning } from './screening-config';

/**
 * Tuning with no environment key of its own, declared once here so no service, stage or adapter holds
 * a default. `toAppConfig` is the only reader; everything else takes the value from `AppConfig`.
 */

/** SDD §10: an idle stream closes after 30 minutes and the client reconnects with Last-Event-ID. */
export const SSE_IDLE_TIMEOUT_MS = 30 * MS_PER_MINUTE;

/** A user stream resuming further back than this many events gets `hello: expired` and refetches. */
export const SSE_REPLAY_LIMIT = 500;

/** A stream this far behind is closed; its client reconnects and replays from the log. */
export const SSE_MAX_PENDING_FRAMES = 1000;

/** How many written ids a video stream remembers to drop a frame pub/sub delivers twice. */
export const SSE_REMEMBERED_IDS = 1024;

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
  playheads: { ttlSeconds: 7 * SECONDS_PER_DAY, flushIntervalMs: MS_PER_MINUTE },
} as const;

export const HOUSEKEEPING = {
  outboxRelayIntervalMs: MS_PER_SECOND,
  outboxBatchSize: 50,
  outboxRetentionDays: 7,
  userEventRetentionDays: 7,
  notificationRetentionDays: NOTIFICATION_RETENTION_DAYS,
  purgeDeletedAfterMs: MS_PER_HOUR,
  stuckProcessingAfterMs: 3 * MS_PER_HOUR,
  stuckUploadingAfterMs: UPLOAD_SESSION_TTL_SECONDS * MS_PER_SECOND,
  stuckUploadedAfterMs: 5 * MS_PER_MINUTE,
  tmpSweepAfterMs: 2 * MS_PER_HOUR,
  stuckCaptionsAfterMs: MS_PER_HOUR,
  reactionReconcileLimit: 500,
  scanLimit: 100,
} as const;

/**
 * A beacon under `minWatchSeconds` is not a view. A view beacon is one small object, so 2 KiB refuses
 * anything else, and 120 a minute per address is far past one viewer. `fallbackCapacity` bounds what the API holds in
 * memory while Redis is unreachable, counted in distinct viewers per video and day.
 */
export const VIEWS = {
  minWatchSeconds: 5,
  dedupTtlSeconds: SECONDS_PER_DAY,
  fallbackCapacity: 10_000,
  breakerFailureThreshold: 3,
  breakerCooldownMs: 5 * MS_PER_SECOND,
  flushIntervalMs: 10 * MS_PER_SECOND,
  batchRetentionMs: MS_PER_DAY,
  bodyLimitBytes: 2 * 1024,
  ratePerMinute: 120,
} as const;

/**
 * A vitals batch is 32 small entries, so 16 KiB refuses anything else early. A page sends a batch or
 * two, so 60 a minute per address is far past one viewer. `maxRoutesPerApp` caps the route label: a
 * client sends any route id it likes, and each new one is a series per histogram.
 */
export const WEB_VITALS = {
  bodyLimitBytes: 16 * 1024,
  ratePerMinute: 60,
  maxRoutesPerApp: 32,
} as const;

/** A playback event is one small object: 2 KiB refuses anything else, and 120 a minute per address is far past one viewer. */
export const PLAYBACK_TELEMETRY = {
  bodyLimitBytes: 2 * 1024,
  ratePerMinute: 120,
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

/**
 * A captions run reads its source through a URL valid for two hours, runs whisper at the lowest CPU
 * priority, and renews its step lease every half minute while whisper prints nothing.
 */
export const CAPTIONS_PROCESS = {
  presignSeconds: 2 * SECONDS_PER_HOUR,
  niceness: 19,
  leaseRenewMs: 30 * MS_PER_SECOND,
} as const;

/**
 * What the screening judges a video against. Not environment keys: the schema is closed, and an
 * operator does not tune a Hamming distance. Each stored result names `version`, so a change here
 * is a new version and never rewrites a decided case.
 */
export const SCREENING_THRESHOLDS = {
  version: 'v1',
  frameMaxHamming: 3,
  duplicateCoverage: 0.9,
  partialCoverage: 0.3,
  partialRunSeconds: 30,
  audioMaxBitErrorRate: 0.35,
  nsfwFrameThreshold: 0.85,
  nsfwShareThreshold: 0.1,
  blankFrameShare: 0.95,
  blankMaxHamming: 2,
  blankMaxLumaRange: 8,
  spamMaxLinks: 3,
  spamMaxTags: 30,
  spamMaxRepeatShare: 0.5,
  spamMaxCapsShare: 0.7,
  spamSignalWeight: 0.4,
  spamHoldScore: 0.8,
} as const satisfies ScreeningThresholds;

/**
 * One frame every 2 s is hashed for the duplicate check and one every 10 s, at most 120 and the first,
 * middle and last, is classified. The audio index keeps every 8th Chromaprint term, about 3 600 rows for
 * an hour of video at the 8 terms a second it produces. A lookup leaves out a 16-bit band with fewer
 * than `minBandSetBits` ones or zeros and a 32-bit term with fewer than `minTermSetBits`, which black
 * frames and silence produce, and takes at most `maxHitsPerKey` rows per band or term it asks for.
 */
export const SCREENING_SAMPLING = {
  hashIntervalSeconds: 2,
  classifyIntervalSeconds: 10,
  classifyMaxFrames: 120,
  audioIndexStride: 8,
  minBandSetBits: 2,
  minTermSetBits: 4,
  maxHitsPerKey: 200,
} as const;

/**
 * The classifier the image carries, as `apps/server/worker/screening.lock` pins it (`SCREENING_MODEL_URL`,
 * `SCREENING_MODEL_SHA256`, licence Apache-2.0): AdamCodd/vit-base-nsfw-detector, int8. The adapter
 * refuses a file whose SHA-256 differs, `labels` maps each label a caller reads to its output index, and
 * the softmax turns the two logits into a probability. A model with other labels is a new entry here,
 * a new `name` and a new threshold version.
 */
export const SCREENING_MODEL = {
  name: 'vit-base-nsfw-detector-int8',
  sha256: '432763a6899ebc418c55f784b98f90565e5fc694c778d2ffcb0294b12f6a7404',
  inputSize: 384,
  mean: 0.5,
  std: 0.5,
  activation: 'softmax',
  labels: { nsfw: 1 },
  intraOpThreads: 2,
  batchSize: 4,
} as const satisfies ScreeningModelTuning;

/**
 * How the `screen` stage runs its processes: the hash sampling and the audio fingerprint stop after
 * `timeoutFactor` times the video's length (at least `minTimeoutMs`), one classifier frame after
 * `frameTimeoutMs`. A moderator sees up to `evidenceFrames` JPEGs of `evidenceWidthPixels` and the `maxMatches` strongest overlaps; the step's lease is renewed every `leaseRenewMs` while the processes run. A video carries no
 * language, so its text is read as each of `metadataLocales`.
 */
export const SCREENING_PROCESS = {
  timeoutFactor: 2,
  minTimeoutMs: 2 * MS_PER_MINUTE,
  frameTimeoutMs: 30 * MS_PER_SECOND,
  decodeConcurrency: 2,
  evidenceFrames: 6,
  evidenceWidthPixels: 320,
  metadataLocales: ['en', 'pl'],
  recentTitleCount: 20,
  maxMatches: 3,
  leaseRenewMs: 30 * MS_PER_SECOND,
} as const satisfies ScreeningProcessTuning;

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

export const PICKS = { defaultRangeMs: 30 * MS_PER_DAY } as const;

/** A receiver that has not answered in five seconds is not going to; a delivery is tried once. */
export const WEBHOOK_DELIVERY = { timeoutMs: 5 * MS_PER_SECOND } as const;

/**
 * LL-HLS for a broadcast: two-second segments of four half-second parts on a five-segment window,
 * parts listed for the newest three. The encoder holds 30 fps with a keyframe every segment, which is
 * what lets the packager count four parts to a segment instead of reading each fragment's timing.
 */
export const LIVE_PACKAGING = {
  fps: 30,
  segmentMs: 2 * MS_PER_SECOND,
  partMs: 500,
  windowSegments: 5,
  partSegments: 3,
  publishWaitMs: 15 * MS_PER_SECOND,
  publishPollMs: 500,
  readTimeoutMs: 10 * MS_PER_SECOND,
  maxBroadcastMs: 12 * MS_PER_HOUR,
} as const;

/** A control call to the ingest gateway sits on a request path, so it gets two seconds and no more. */
export const LIVE_GATEWAY_TIMEOUT_MS = 2 * MS_PER_SECOND;

/**
 * Live chat and presence. A one-time chat token only has to outlive the socket opening right after
 * it is fetched; a viewer is counted until it misses two heartbeats, so a dead pod drops its viewers.
 */
export const LIVE_CHAT = {
  ticketTtlSeconds: 30,
  burst: { messages: 5, windowSeconds: 10 },
  resumeLimit: 200,
  replayLimit: 500,
  maxFrameBytes: 4096,
  maxBufferedBytes: 1024 * 1024,
  pingIntervalMs: 30 * MS_PER_SECOND,
  listLimit: 48,
  presenceHeartbeatMs: 15 * MS_PER_SECOND,
  presenceWindowMs: 40 * MS_PER_SECOND,
} as const;
