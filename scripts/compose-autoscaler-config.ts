import type {
  AutoscalerConfig,
  ScalerStageConfig,
} from '../packages/platform/server/compose-autoscaler/src/index';

const stage = (maxReplicas: number, threshold = 1, cooldownSeconds = 300): ScalerStageConfig => ({
  minReplicas: 0,
  maxReplicas,
  threshold,
  cooldownSeconds,
});

/** Matches the KEDA ScaledObject parameters of SDD §13.2. */
export const COMPOSE_AUTOSCALER_CONFIG: AutoscalerConfig = {
  metricsPath: '/metrics',
  stages: {
    'worker-probe': stage(4),
    'worker-transcode-1080p': stage(6),
    'worker-transcode-720p': stage(6),
    'worker-transcode-480p': stage(6),
    'worker-thumbnail': stage(4),
    'worker-screen': stage(4),
    'worker-captions': stage(4),
    'worker-live': stage(4, 4, 1800),
    'worker-package': stage(4),
    'worker-notify': stage(4),
    'worker-housekeeping': stage(2),
  },
};
