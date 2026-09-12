import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
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
import { getMetrics } from '@vp/observability';
import fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { registerAuth } from './plugins/auth';
import { registerErrorHandler } from './plugins/errors';
import { registerHttpMetricsPlugin } from './plugins/http-metrics';
import { registerAdminDlqRoutes } from './routes/admin/dlq';
import { registerAdminQueuesRoutes } from './routes/admin/queues';
import { registerDevJwksRoute } from './routes/dev-jwks';
import { registerEventsRoutes } from './routes/events';
import { registerHealthRoutes } from './routes/health';
import { registerUploadsRoutes } from './routes/uploads';
import { registerVideosRoutes } from './routes/videos';
import { registerHousekeepingSchedulers } from './services/housekeeping-schedulers';
import { startQueuePoller } from './services/queue-poller';
import { startSqlPoller } from './services/sql-poller';
import { SseHub } from './services/sse-hub';

export * from './services/index';

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
  maxInflightPerUser?: number;
  sseHub?: SseHub;
  sseMaxPerUser?: number;
  sseMaxPodConnections?: number;
  sseHeartbeatMs?: number;
  sseIdleTimeoutMs?: number;
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

  const housekeepingQueue = adminQueues.get('housekeeping');
  if (housekeepingQueue) {
    await registerHousekeepingSchedulers(housekeepingQueue);
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

  // 5a. Register HTTP RED metrics hooks (http_request_duration_seconds, http_requests_in_flight)
  await app.register(registerHttpMetricsPlugin);

  // 6. Register OpenAPI Documentation (/docs)
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'video-pipeline API',
        description:
          'Asynchronous video ingestion and HLS transcoding API. All video playback assets (master and media playlists, segments) are served via public CDN.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Dev or production bearer JWT',
          },
          adminToken: {
            type: 'apiKey',
            in: 'header',
            name: 'x-admin-token',
            description: 'Static admin token for administrative operations',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      pageTitle: 'video-pipeline API Documentation',
    },
  });

  app.get('/openapi.json', { schema: { hide: true } }, async (_req, reply) => {
    return reply.header('Content-Type', 'application/json').send(app.swagger());
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
    maxInflightPerUser: options.maxInflightPerUser,
  });

  registerVideosRoutes(app, {
    videos: repositories.videos,
    cdnBaseUrl,
    probeQueue: jobQueue,
  });

  const sseHub =
    options.sseHub ??
    new SseHub({
      cache,
      maxConnectionsPerUser: options.sseMaxPerUser,
      maxPodConnections: options.sseMaxPodConnections,
      heartbeatMs: options.sseHeartbeatMs,
      idleTimeoutMs: options.sseIdleTimeoutMs,
    });
  await sseHub.init();

  registerEventsRoutes(app, {
    sseHub,
    repositories,
    cdnBaseUrl,
  });

  app.addHook('onClose', async () => {
    await sseHub.close();
    queuePoller.stop();
    sqlPoller.stop();
  });

  // Start queue + SQL pollers after SSE hub initialisation
  const metrics = getMetrics();
  const queuePoller = startQueuePoller({ queues: adminQueues, metrics });
  const sqlPoller = startSqlPoller({ repositories, metrics });

  await registerAdminQueuesRoutes(app, {
    cache,
    queues: adminQueues,
  });

  registerAdminDlqRoutes(app, {
    repositories,
    queues: adminQueues,
  });

  return app;
}
