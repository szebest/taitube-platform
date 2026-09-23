import type { PipelineMetrics } from '@vp/observability';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export interface HttpMetricsOptions {
  metrics: PipelineMetrics;
}

/** `fastify-plugin` lifts these hooks out of the plugin's scope, so they time every route. */
async function httpMetricsPlugin(app: FastifyInstance, { metrics }: HttpMetricsOptions) {
  app.addHook('onRequest', async () => {
    metrics.httpRequestsInFlight.inc();
  });

  app.addHook('onResponse', async (req, reply) => {
    metrics.httpRequestsInFlight.dec();

    const route = (req.routeOptions as { url?: string } | undefined)?.url ?? req.url ?? 'unknown';
    metrics.httpRequestDuration.observe(
      { method: req.method ?? 'unknown', route, status: String(reply.statusCode) },
      reply.elapsedTime / 1000
    );
  });
}

export const registerHttpMetricsPlugin = fp(httpMetricsPlugin, {
  name: 'vp-http-metrics',
  fastify: '5.x',
});
