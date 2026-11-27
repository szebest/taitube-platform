import type { MetricsRoutes } from '@kit/observability';

export const METRICS_ROUTES: MetricsRoutes = {
  metrics: '/metrics',
  health: '/healthz',
  ready: '/readyz',
};
