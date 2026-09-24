import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { REQUEST_ID_HEADER } from './request-id';
import { routeLabel } from './route-label';

/**
 * One line per request, written when the response is done, or when the client hangs up first. Fastify's own request logging is off
 * because it writes two lines and logs the URL, which carries ids a route template would not.
 */
async function accessLogPlugin(app: FastifyInstance) {
  app.addHook('onSend', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: routeLabel(request),
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request completed'
    );
  });

  app.addHook('onRequestAbort', async (request) => {
    request.log.info({ method: request.method, route: routeLabel(request) }, 'request aborted');
  });
}

export const registerAccessLog = fp(accessLogPlugin, { name: 'vp-access-log', fastify: '5.x' });
