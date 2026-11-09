import { SCREENING_MODEL } from './tuning';

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

export interface ScreeningConfig {
  modelPath: string;
  model: ScreeningModelTuning;
}

export function screeningConfig(keys: Pick<ScreeningConfig, 'modelPath'>): ScreeningConfig {
  return { ...keys, model: SCREENING_MODEL };
}
