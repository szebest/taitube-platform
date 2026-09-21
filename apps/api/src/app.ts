import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import {
  BullMqJobQueue,
  CaslAuthorizationAdapter,
  CategoryCacheService,
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  PostgresDatabaseClient,
  PostgresRepositories,
  RedisCacheClient,
  RedisReactionCacheAdapter,
  S3MultipartStorage,
  S3StorageClient,
  RedisSubscriptionCacheAdapter,
  InMemorySubscriptionCache,
} from '@vp/adapters';
import type {
  AuthorizationPort,
  CacheClient,
  DatabaseClient,
  JobQueue,
  MultipartStorage,
  ReactionCachePort,
  Repositories,
  StorageClient,
  SubscriptionCachePort,
} from '@vp/core/ports';
import { Paginator } from '@vp/core/pagination';
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
import { registerAuthorization } from './plugins/authorization';
import { registerErrorHandler } from './plugins/errors';
import { registerHttpMetricsPlugin } from './plugins/http-metrics';
import { registerAdminCategoriesRoutes } from './routes/admin/categories';
import { registerAdminDlqRoutes } from './routes/admin/dlq';
import { registerAdminQueuesRoutes } from './routes/admin/queues';
import { registerCategoriesRoutes } from './routes/categories';
import { registerChannelsRoutes } from './routes/channels';
import { registerDevJwksRoute } from './routes/dev-jwks';
import { registerEventsRoutes } from './routes/events';
import { registerFeedRoutes } from './routes/feed';
import { registerHealthRoutes } from './routes/health';
import { registerMeRoutes } from './routes/me';
import { registerReactionsRoutes } from './routes/reactions';
import { registerSubscriptionsRoutes } from './routes/subscriptions';
import { registerUploadsRoutes } from './routes/uploads';
import { registerVideosRoutes } from './routes/videos';
import { VideoService } from './services/video-service';
import { CategoryService } from './services/category-service';
import { DlqService } from './services/dlq-service';
import { QueueService } from './services/queue-service';
import { HttpCacheService } from './services/http-cache-service';
import { ChannelService } from './services/channel-service';
import { ReactionService } from './services/reaction-service';
import { SubscriptionService } from './services/subscription-service';
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
  paginator?: Paginator;
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
  categoryCacheService?: CategoryCacheService;
  categoryService?: CategoryService;
  dlqService?: DlqService;
  queueService?: QueueService;
  httpCacheService?: HttpCacheService;
  channelService?: ChannelService;
  reactionCache?: ReactionCachePort;
  reactionCacheAdapter?: ReactionCachePort;
  reactionService?: ReactionService;
  subscriptionCache?: SubscriptionCachePort;
  subscriptionService?: SubscriptionService;
  jwksUrl?: string;
  authorization?: AuthorizationPort;
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

  const paginator =
    options.paginator ??
    new Paginator({
      defaultLimit: Number(process.env['PAGE_SIZE_DEFAULT']) || undefined,
      maxLimit: Number(process.env['PAGE_SIZE_MAX']) || undefined,
    });

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

  // 5. Register Authentication Plugin (dev token verification + universal JWKS + JIT provisioning)
  await app.register(registerAuth, {
    repositories,
    jwksUrl: options.jwksUrl,
  });

  // 5a. Register Declarative RBAC/ABAC Authorization Plugin
  await app.register(registerAuthorization);

  // 5b. Register HTTP RED metrics hooks (http_request_duration_seconds, http_requests_in_flight)
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

  const reactionCache =
    options.reactionCache ??
    options.reactionCacheAdapter ??
    new RedisReactionCacheAdapter({
      cache,
    });

  const reactionService =
    options.reactionService ??
    new ReactionService({
      videoReactions: repositories.videoReactions,
      reactionCache,
      videos: repositories.videos,
    });

  const authorization = options.authorization ?? new CaslAuthorizationAdapter();

  const videoService = new VideoService({
    videos: repositories.videos,
    cdnBaseUrl,
    reactionCache,
    authorization,
    paginator,
  });

  registerVideosRoutes(app, {
    videos: repositories.videos,
    videoService,
    cdnBaseUrl,
    probeQueue: jobQueue,
  });

  registerReactionsRoutes(app, {
    reactionService,
  });

  registerFeedRoutes(app, {
    videoService,
    cache,
  });

  const httpCacheService = options.httpCacheService ?? new HttpCacheService();

  const categoryCacheService =
    options.categoryCacheService ??
    new CategoryCacheService({
      cache,
    });

  const categoryService =
    options.categoryService ??
    new CategoryService({
      categories: repositories.categories,
      categoryCacheService,
      httpCacheService,
    });

  registerCategoriesRoutes(app, {
    categoryService,
  });

  registerAdminCategoriesRoutes(app, {
    categoryService,
  });

  const channelService =
    options.channelService ??
    new ChannelService({
      users: repositories.users,
      channels: repositories.channels,
    });

  registerMeRoutes(app, {
    channelService,
  });

  registerChannelsRoutes(app, {
    channelService,
  });

  const subscriptionCache =
    options.subscriptionCache ??
    (cache instanceof RedisCacheClient
      ? new RedisSubscriptionCacheAdapter({ redis: cache.getRedis() })
      : new InMemorySubscriptionCache());

  const subscriptionService =
    options.subscriptionService ??
    new SubscriptionService({
      subscriptions: repositories.subscriptions,
      channels: repositories.channels,
      subscriptionCache,
      cdnBaseUrl,
      paginator,
    });

  registerSubscriptionsRoutes(app, {
    subscriptionService,
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
    categoryCacheService.close();
    await sseHub.close();
    queuePoller.stop();
    sqlPoller.stop();
  });

  // Start queue + SQL pollers after SSE hub initialisation
  const metrics = getMetrics();
  const queuePoller = startQueuePoller({ queues: adminQueues, metrics });
  const sqlPoller = startSqlPoller({ repositories, metrics });

  const queueService =
    options.queueService ??
    new QueueService({
      queues: adminQueues,
    });

  await registerAdminQueuesRoutes(app, {
    cache,
    queues: adminQueues,
    queueService,
  });

  const dlqService =
    options.dlqService ??
    new DlqService({
      dlq: repositories.dlq,
      events: repositories.events,
      queues: adminQueues,
    });

  registerAdminDlqRoutes(app, {
    dlqService,
  });

  return app;
}
