import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  BullMqJobQueue,
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  PostgresDatabaseClient,
  PostgresRepositories,
  RedisCacheClient,
  S3MultipartStorage,
  S3StorageClient,
} from '@vp/adapters';
import type {
  CacheClient,
  DatabaseClient,
  JobQueue,
  MultipartStorage,
  Repositories,
  StorageClient,
} from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerAdminQueuesRoutes } from './routes/admin/queues.js';
import { registerDevJwksRoute } from './routes/dev-jwks.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerUploadsRoutes } from './routes/uploads.js';
import { registerVideosRoutes } from './routes/videos.js';

export * from './services/index.js';

export interface BuildAppOptions {
  dbClient?: DatabaseClient;
  repositories?: Repositories;
  cache?: CacheClient;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  jobQueue?: JobQueue;
  rawBucket?: string;
  cdnBaseUrl?: string;
  rateLimitMax?: number;
  maxUploadBytes?: number;
  multipartThresholdBytes?: number;
  adminQueues?: Map<string, JobQueue>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  });

  const isInMemory =
    options.cache instanceof InMemoryCacheClient ||
    options.cache?.constructor.name === 'InMemoryCacheClient' ||
    options.repositories instanceof InMemoryRepositories ||
    options.repositories?.constructor.name === 'InMemoryRepositories' ||
    options.dbClient instanceof InMemoryDatabaseClient ||
    options.dbClient?.constructor.name === 'InMemoryDatabaseClient' ||
    process.env['NODE_ENV'] === 'test';

  // Wire ports with default concrete adapters when omitted
  const dbClient =
    options.dbClient ?? (isInMemory ? new InMemoryDatabaseClient() : new PostgresDatabaseClient());
  const repositories =
    options.repositories ?? (isInMemory ? new InMemoryRepositories() : new PostgresRepositories());
  const storage =
    options.storage ?? (isInMemory ? new InMemoryStorageClient() : new S3StorageClient());
  const multipart =
    options.multipart ??
    (isInMemory
      ? new InMemoryMultipartStorage(storage)
      : new S3MultipartStorage({
          storageClient: storage instanceof S3StorageClient ? storage : undefined,
        }));
  const cache = options.cache ?? (isInMemory ? new InMemoryCacheClient() : new RedisCacheClient());

  let adminQueues = options.adminQueues;
  if (!adminQueues) {
    adminQueues = new Map<string, JobQueue>();
    for (const qName of QUEUES) {
      adminQueues.set(
        qName,
        isInMemory ? new InMemoryJobQueue(qName) : new BullMqJobQueue({ name: qName })
      );
    }
  }

  const jobQueue = options.jobQueue ?? adminQueues.get('probe');

  const rawBucket = options.rawBucket ?? process.env['STORAGE_RAW_BUCKET'] ?? 'raw';
  const cdnBaseUrl =
    options.cdnBaseUrl ?? process.env['CDN_BASE_URL'] ?? 'http://localhost:9000/public';

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

  // 7. Register Routes with injected ports
  registerHealthRoutes(app, {
    dbClient,
    cache,
    storage,
  });

  registerDevJwksRoute(app);

  registerUploadsRoutes(app, {
    repositories,
    storage,
    multipart,
    rawBucket,
    probeQueue: jobQueue,
    rateLimitMax: options.rateLimitMax,
    maxUploadBytes: options.maxUploadBytes,
    multipartThresholdBytes: options.multipartThresholdBytes,
  });

  registerVideosRoutes(app, {
    videos: repositories.videos,
    cdnBaseUrl,
  });

  await registerAdminQueuesRoutes(app, {
    cache,
    queues: adminQueues,
  });

  return app;
}
