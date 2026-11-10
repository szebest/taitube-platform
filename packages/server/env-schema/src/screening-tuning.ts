import type { ScreeningThresholds } from '@vp/domain';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@vp/domain/time';
import type { ScreeningModelTuning, ScreeningProcessTuning } from './screening-config';

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
  blankMinFrames: 3,
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
