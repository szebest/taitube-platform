import { createMetricsRegistry } from '@vp/observability';
import fastify from 'fastify';
import { registerHttpMetricsPlugin } from '../http-metrics';

async function recordedRoutes(url: string): Promise<string[]> {
  const metrics = createMetricsRegistry();
  const app = fastify();
  await app.register(registerHttpMetricsPlugin, { metrics });
  app.get('/v1/videos/:id', async () => ({ ok: true }));

  await app.inject({ method: 'GET', url });
  await app.close();

  const { values } = await metrics.httpRequestDuration.get();
  return [
    ...new Set(
      values.filter((v) => v.metricName?.endsWith('_count')).map((v) => String(v.labels.route))
    ),
  ];
}

describe('apps/api/plugins: http metrics', () => {
  it.each([
    ['a matched path', '/v1/videos/abc', '/v1/videos/:id'],
    ['a 404', '/wp-login.php?x=1', 'unmatched'],
  ])('labels %s with its route template', async (_name, url, route) => {
    expect(await recordedRoutes(url)).toEqual([route]);
  });
});
