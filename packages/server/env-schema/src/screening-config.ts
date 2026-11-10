import type { ScreeningThresholds } from '@vp/domain';
import {
  SCREENING_MODEL,
  SCREENING_PROCESS,
  SCREENING_SAMPLING,
  SCREENING_THRESHOLDS,
} from './tuning';

export interface ScreeningModelTuning {
  /** Names the model in each stored result. */
  name: string;
  /** The lock file's pin: the model file is refused when its SHA-256 is another. */
  sha256: string;
  /** The side, in pixels, of the square frames the model takes. */
  inputSize: number;
  mean: number;
  std: number;
  /** `softmax` turns the output logits into probabilities; `none` reads them as scores. */
  activation: 'softmax' | 'none';
  /** Each label a caller reads, with its index in the model's output. */
  labels: Readonly<Record<string, number>>;
  intraOpThreads: number;
  batchSize: number;
}

interface ScreeningSampling {
  hashIntervalSeconds: number;
  classifyIntervalSeconds: number;
  classifyMaxFrames: number;
  audioIndexStride: number;
  minBandSetBits: number;
  minTermSetBits: number;
  maxHitsPerKey: number;
}

export interface ScreeningProcessTuning {
  timeoutFactor: number;
  minTimeoutMs: number;
  frameTimeoutMs: number;
  decodeConcurrency: number;
  evidenceFrames: number;
  evidenceWidthPixels: number;
  metadataLocales: readonly string[];
  recentTitleCount: number;
  maxMatches: number;
  leaseRenewMs: number;
}

export interface ScreeningConfig {
  /** The operator's way out of fail-closed screening: off, probe adds no `screen` child. */
  enabled: boolean;
  modelPath: string;
  model: ScreeningModelTuning;
  thresholds: ScreeningThresholds;
  sampling: ScreeningSampling;
  process: ScreeningProcessTuning;
}

export function screeningConfig(
  keys: Pick<ScreeningConfig, 'enabled' | 'modelPath'>
): ScreeningConfig {
  return {
    ...keys,
    model: SCREENING_MODEL,
    thresholds: SCREENING_THRESHOLDS,
    sampling: SCREENING_SAMPLING,
    process: SCREENING_PROCESS,
  };
}
