import { METRICS_ROUTES } from '../metrics-routes';

describe('METRICS_ROUTES', () => {
  it('are the paths Prometheus, the compose healthchecks and the probes call', () => {
    expect(METRICS_ROUTES).toEqual({ metrics: '/metrics', health: '/healthz', ready: '/readyz' });
  });
});
