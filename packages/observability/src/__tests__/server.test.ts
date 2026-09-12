import { Registry } from 'prom-client';
import { describe, expect, it } from 'vitest';
import { startMetricsServer } from '../server';

describe('@vp/observability startMetricsServer', () => {
  it('serves metrics from the provided registry and healthz endpoint', async () => {
    const registry = new Registry();
    registry.setDefaultLabels({ app: 'test-app' });

    const server = await startMetricsServer({
      port: 0,
      registry,
    });

    try {
      expect(server.port).toBeGreaterThan(0);

      const metricsRes = await fetch(`http://127.0.0.1:${server.port}/metrics`);
      expect(metricsRes.status).toBe(200);
      expect(metricsRes.headers.get('content-type')).toContain('text/plain');
      const metricsText = await metricsRes.text();
      expect(typeof metricsText).toBe('string');

      const healthRes = await fetch(`http://127.0.0.1:${server.port}/healthz`);
      expect(healthRes.status).toBe(200);
      const healthText = await healthRes.text();
      expect(healthText).toBe('ok');

      const notFoundRes = await fetch(`http://127.0.0.1:${server.port}/unknown`);
      expect(notFoundRes.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
