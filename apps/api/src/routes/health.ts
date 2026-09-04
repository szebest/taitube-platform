import type { CacheClient, DatabaseClient, StorageClient } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';

export interface HealthRouteOptions {
  dbClient?: DatabaseClient | null;
  cache?: CacheClient | null;
  storage?: StorageClient | null;
}

export function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions): void {
  const { dbClient, cache, storage } = options;

  // Liveness probe (SDD §6.1)
  app.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Readiness probe: checks Postgres, Redis, S3 (SDD §6.1, AC 6)
  app.get('/readyz', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'failed'> = {
      postgres: 'ok',
      redis: 'ok',
      s3: 'ok',
    };
    let isHealthy = true;

    // 1. Postgres check
    if (dbClient) {
      try {
        const dbOk = await dbClient.checkHealth();
        if (!dbOk) {
          checks['postgres'] = 'failed';
          isHealthy = false;
        }
      } catch {
        checks['postgres'] = 'failed';
        isHealthy = false;
      }
    }

    // 2. Redis check
    if (cache) {
      try {
        const cacheOk = await cache.checkHealth();
        if (!cacheOk) {
          checks['redis'] = 'failed';
          isHealthy = false;
        }
      } catch {
        checks['redis'] = 'failed';
        isHealthy = false;
      }
    }

    // 3. S3 check
    if (storage) {
      try {
        const s3Ok = await storage.checkHealth();
        if (!s3Ok) {
          checks['s3'] = 'failed';
          isHealthy = false;
        }
      } catch {
        checks['s3'] = 'failed';
        isHealthy = false;
      }
    }

    const statusCode = isHealthy ? 200 : 503;
    return reply.status(statusCode).send({
      status: isHealthy ? 'ok' : 'degraded',
      checks,
    });
  });
}
