import type { FastifyInstance } from 'fastify';

/** navigator.sendBeacon posts text/plain to stay a simple request with no CORS preflight. */
export function acceptBeaconBodies(app: FastifyInstance): void {
  app.removeContentTypeParser('text/plain');
  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    app.getDefaultJsonParser('error', 'error')
  );
}
