import { getDevJwks } from '@vp/dev-token';
import type { FastifyInstance } from 'fastify';

export function registerDevJwksRoute(app: FastifyInstance): void {
  app.get('/.well-known/jwks.json', async (_request, reply) => {
    return reply.status(200).send(getDevJwks());
  });
}
