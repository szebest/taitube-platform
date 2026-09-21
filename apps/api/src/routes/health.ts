import { DegradedSchema, liveness, livenessAlias, readiness } from '@vp/api-contracts';
import type { CacheClient, DatabaseClient, HealthCheckable, StorageClient } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';

export interface HealthRouteOptions {
  dbClient?: DatabaseClient | null;
  cache?: CacheClient | null;
  storage?: StorageClient | null;
}

async function isReachable(dependency?: HealthCheckable | null): Promise<boolean> {
  if (!dependency) {
    return true;
  }
  try {
    return await dependency.checkHealth();
  } catch {
    return false;
  }
}

export function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions): void {
  const { dbClient, cache, storage } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  const livenessHandler = async () => {
    return { status: 'ok' as const };
  };

  server.get(liveness.path, { schema: contractSchema(liveness) }, livenessHandler);

  server.get(livenessAlias.path, { schema: contractSchema(livenessAlias) }, livenessHandler);

  server.get(
    readiness.path,
    { schema: contractSchema(readiness, { responses: { 503: DegradedSchema } }) },
    async (_request, reply) => {
      const dependencies = {
        postgres: dbClient,
        redis: cache,
        s3: storage,
      };

      const checks: Record<string, 'ok' | 'failed'> = {};
      let isHealthy = true;

      for (const [name, dependency] of Object.entries(dependencies)) {
        checks[name] = (await isReachable(dependency)) ? 'ok' : 'failed';
        isHealthy = isHealthy && checks[name] === 'ok';
      }

      const statusCode = isHealthy ? 200 : 503;
      return reply.status(statusCode).send({
        status: isHealthy ? 'ok' : 'degraded',
        checks,
      });
    }
  );
}
