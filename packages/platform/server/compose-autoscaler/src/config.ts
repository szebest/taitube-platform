import type { ScalerStageConfig } from './scaler';

export interface AutoscalerConfig {
  readonly metricsPath: string;
  readonly stages: Readonly<Record<string, ScalerStageConfig>>;
}
