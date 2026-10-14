import { DegradedSchema, liveness, livenessAlias, readiness } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';

/** Liveness never consults readiness: a draining process is alive until it exits. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const { readiness: probe } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  const livenessHandler = async () => ({ status: 'ok' as const });

  server.get(liveness.path, { schema: contractSchema(liveness) }, livenessHandler);
  server.get(livenessAlias.path, { schema: contractSchema(livenessAlias) }, livenessHandler);

  server.get(
    readiness.path,
    { schema: contractSchema(readiness, { responses: { 503: DegradedSchema } }) },
    async (_request, reply) => {
      const { ready, checks } = await probe.report();
      return reply.status(ready ? 200 : 503).send({ status: ready ? 'ok' : 'degraded', checks });
    }
  );
}
