import type { Database } from '@vp/db';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export interface HealthRouteOptions {
  db: Database;
  redisClient?: Redis | null;
  s3HealthCheck?: () => Promise<boolean>;
}

export function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions): void {
  const { db, redisClient, s3HealthCheck } = options;

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

    // 1. Postgres check (SELECT 1)
    try {
      await db.execute(sql`SELECT 1 as healthy;`);
    } catch {
      checks.postgres = 'failed';
      isHealthy = false;
    }

    // 2. Redis check (PING -> PONG)
    if (redisClient) {
      try {
        const pingRes = await redisClient.ping();
        if (pingRes !== 'PONG') {
          checks.redis = 'failed';
          isHealthy = false;
        }
      } catch {
        checks.redis = 'failed';
        isHealthy = false;
      }
    }

    // 3. S3 check
    if (s3HealthCheck) {
      try {
        const s3Ok = await s3HealthCheck();
        if (!s3Ok) {
          checks.s3 = 'failed';
          isHealthy = false;
        }
      } catch {
        checks.s3 = 'failed';
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
