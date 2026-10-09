import type { PipelineMetrics } from '@vp/observability';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { routeLabel } from './route-label';

export interface HttpMetricsOptions {
  metrics: PipelineMetrics;
}

/** `fastify-plugin` lifts these hooks out of the plugin's scope, so they time every route. */
async function httpMetricsPlugin(app: FastifyInstance, { metrics }: HttpMetricsOptions) {
  app.addHook('onRequest', async () => {
    metrics.httpRequestsInFlight.inc();
  });

  app.addHook('onResponse', async (request, reply) => {
    metrics.httpRequestsInFlight.dec();
    metrics.httpRequestDuration.observe(
      { method: request.method, route: routeLabel(request), status: String(reply.statusCode) },
      reply.elapsedTime / 1000
    );
  });
}

export const registerHttpMetricsPlugin = fp(httpMetricsPlugin, {
  name: 'vp-http-metrics',
  fastify: '5.x',
});
