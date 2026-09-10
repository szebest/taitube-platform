import { getMetrics } from '@vp/observability';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Fastify plugin: HTTP RED metrics (Ticket 22 AC 1).
 *
 * Wires:
 *  - http_requests_in_flight  (gauge)         – inc on onRequest, dec on onResponse
 *  - http_request_duration_seconds (histogram) – observed on onResponse
 *
 * Uses fastify-plugin so hooks apply to ALL routes (no encapsulation boundary).
 */
async function httpMetricsPlugin(app: FastifyInstance): Promise<void> {
  const m = getMetrics();

  app.addHook('onRequest', async () => {
    m.httpRequestsInFlight.inc();
  });

  app.addHook('onResponse', async (req, reply) => {
    m.httpRequestsInFlight.dec();

    // routeOptions.url is the pattern (e.g. /v1/videos/:id), not the real URL
    const route = (req.routeOptions as { url?: string } | undefined)?.url ?? req.url ?? 'unknown';
    const method = req.method ?? 'unknown';
    const status = String(reply.statusCode);
    // Fastify reply.elapsedTime is ms since request arrival
    const elapsedSec = reply.elapsedTime / 1000;

    m.httpRequestDuration.observe({ method, route, status }, elapsedSec);
  });
}

export const registerHttpMetricsPlugin = fp(httpMetricsPlugin, {
  name: 'vp-http-metrics',
  fastify: '5.x',
});
