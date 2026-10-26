import { CAPTIONS_PROCESS } from './tuning';

export interface CaptionsConfig {
  enabled: boolean;
  whisperPath: string;
  modelPath: string;
  vadModelPath: string;
  /** Named after the model file, so a new model is a new captions job id and a new track run. */
  modelVersion: string;
  threads: number;
  process: { presignSeconds: number; niceness: number; leaseRenewMs: number };
}

/** `/opt/whisper/ggml-small-q5_1.bin` is `small-q5_1`. */
export function modelVersionOf(modelPath: string): string {
  const file = modelPath.slice(modelPath.lastIndexOf('/') + 1);
  const stem = file.endsWith('.bin') ? file.slice(0, -'.bin'.length) : file;
  return stem.startsWith('ggml-') ? stem.slice('ggml-'.length) : stem;
}

/** The keys as `toAppConfig` read them, named after the model file and given their tuning. */
export function captionsConfig(
  keys: Omit<CaptionsConfig, 'modelVersion' | 'process'>
): CaptionsConfig {
  return {
    ...keys,
    modelVersion: modelVersionOf(keys.modelPath),
    process: { ...CAPTIONS_PROCESS },
  };
}
