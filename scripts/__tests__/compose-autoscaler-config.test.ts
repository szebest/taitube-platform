import { isScalerStageConfig } from '../../packages/platform/server/compose-autoscaler/src/index';
import { COMPOSE_AUTOSCALER_CONFIG } from '../compose-autoscaler-config';

describe('scripts: compose-autoscaler config', () => {
  it('scrapes the worker metrics path', () => {
    expect(COMPOSE_AUTOSCALER_CONFIG.metricsPath).toBe('/metrics');
  });

  it.each(Object.entries(COMPOSE_AUTOSCALER_CONFIG.stages))(
    '%s scales from zero within its bounds',
    (_stage, config) => {
      expect(isScalerStageConfig(config)).toBe(true);
      expect(config.minReplicas).toBe(0);
      expect(config.maxReplicas).toBeGreaterThan(0);
    }
  );

  it('keeps a live stream up for half an hour after its last job', () => {
    expect(COMPOSE_AUTOSCALER_CONFIG.stages['worker-live']).toEqual({
      minReplicas: 0,
      maxReplicas: 4,
      threshold: 4,
      cooldownSeconds: 1800,
    });
  });
});
