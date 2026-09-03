import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { type Database, createDbClient } from '@vp/db';
import { ErrorCodes } from '@vp/errors';
import type { S3Client } from '@vp/storage';
import { createStorageClient } from '@vp/storage';
import type { Queue } from 'bullmq';
import fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerAdminQueuesRoutes } from './routes/admin/queues.js';
import { registerDevJwksRoute } from './routes/dev-jwks.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerUploadsRoutes } from './routes/uploads.js';
import { registerVideosRoutes } from './routes/videos.js';

export interface BuildAppOptions {
  db?: Database;
  redisClient?: Redis | null;
  s3Client?: S3Client;
  s3HealthCheck?: () => Promise<boolean>;
  rawBucket?: string;
  probeQueue?: Queue;
  cdnBaseUrl?: string;
  rateLimitMax?: number;
  maxUploadBytes?: number;
  adminQueues?: Map<string, Queue>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  });

  const db = options.db ?? createDbClient().db;
  const s3Client = options.s3Client ?? createStorageClient();
  const rawBucket = options.rawBucket ?? process.env.STORAGE_RAW_BUCKET ?? 'raw';
  const cdnBaseUrl =
    options.cdnBaseUrl ?? process.env.CDN_BASE_URL ?? 'http://localhost:9000/public';

  // 1. Configure Zod Type Provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 2. Register Security & Middleware Plugins
  await app.register(cors, {
    origin: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // 3. Register Rate Limit Plugin
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (req) => ({
      type: `https://errors.video-pipeline.local/${ErrorCodes.RATE_LIMITED}`,
      title: 'Too Many Requests',
      status: 429,
      detail: 'Rate limit exceeded',
      code: ErrorCodes.RATE_LIMITED,
      instance: req.url,
    }),
  });

  // 4. Register RFC 9457 Problem+JSON Error Handler
  registerErrorHandler(app);

  // 5. Register Authentication Plugin (dev token verification)
  await app.register(registerAuth);

  // 6. Register OpenAPI Documentation (/docs)
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'video-pipeline API',
        description: 'Asynchronous video ingestion and HLS transcoding API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // 7. Register Routes
  registerHealthRoutes(app, {
    db,
    redisClient: options.redisClient,
    s3HealthCheck: options.s3HealthCheck,
  });

  registerDevJwksRoute(app);

  registerUploadsRoutes(app, {
    db,
    s3Client,
    rawBucket,
    probeQueue: options.probeQueue,
    rateLimitMax: options.rateLimitMax,
    maxUploadBytes: options.maxUploadBytes,
  });

  registerVideosRoutes(app, {
    db,
    cdnBaseUrl,
  });

  await registerAdminQueuesRoutes(app, {
    redisClient: options.redisClient,
    queues: options.adminQueues,
  });

  return app;
}
