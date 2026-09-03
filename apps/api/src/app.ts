import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { type Database, createDbClient } from '@vp/db';
import fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Redis } from 'ioredis';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerDevJwksRoute } from './routes/dev-jwks.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerVideosRoutes } from './routes/videos.js';

export interface BuildAppOptions {
  db?: Database;
  redisClient?: Redis | null;
  s3HealthCheck?: () => Promise<boolean>;
  cdnBaseUrl?: string;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  });

  const db = options.db ?? createDbClient().db;
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

  // 3. Register RFC 9457 Problem+JSON Error Handler
  registerErrorHandler(app);

  // 4. Register Authentication Plugin (dev token verification)
  await app.register(registerAuth);

  // 5. Register OpenAPI Documentation (/docs)
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

  // 6. Register Routes
  registerHealthRoutes(app, {
    db,
    redisClient: options.redisClient,
    s3HealthCheck: options.s3HealthCheck,
  });

  registerDevJwksRoute(app);

  registerVideosRoutes(app, {
    db,
    cdnBaseUrl,
  });

  return app;
}
