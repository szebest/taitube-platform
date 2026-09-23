import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { DEFAULT_CDN_BASE_URL } from '@vp/env-schema';
import { toPipelineError } from '@vp/errors';
import { getMetrics } from '@vp/observability';
import { isErr } from '@vp/result';
import fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { type AdapterOverrides, resolveAdapterSet } from './composition/adapter-set';
import { registerOpenApi } from './composition/openapi';
import { type AppLimits, createServiceSet } from './composition/service-set';
import { registerAuth } from './plugins/auth';
import { rateLimitProblem, registerErrorHandler } from './plugins/errors';
import { registerHttpMetricsPlugin } from './plugins/http-metrics';
import { registerAdminCategoriesRoutes } from './routes/admin/categories';
import { registerAdminDlqRoutes } from './routes/admin/dlq';
import { registerAdminQueuesRoutes } from './routes/admin/queues';
import { registerAdminVideosRoutes } from './routes/admin/videos';
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
import { registerHousekeepingSchedulers } from './services/housekeeping-schedulers';
import { startQueuePoller } from './services/queue-poller';
import { startSqlPoller } from './services/sql-poller';

export * from './composition/adapter-set';
export * from './composition/service-set';
export * from './services/index';

export interface BuildAppOptions {
  adapters?: AdapterOverrides;
  limits?: AppLimits;
  cdnBaseUrl?: string;
  rawBucket?: string;
  jwksUrl?: string;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({ logger: false });
  const limits = options.limits ?? {};

  const adapters = resolveAdapterSet(options.adapters);
  const rawBucket = options.rawBucket ?? process.env['STORAGE_RAW_BUCKET'] ?? 'raw';
  const cdnBaseUrl = options.cdnBaseUrl ?? process.env['CDN_BASE_URL'] ?? DEFAULT_CDN_BASE_URL;

  const housekeepingQueue = adapters.queues.get('housekeeping');
  if (housekeepingQueue) {
    const registered = await registerHousekeepingSchedulers(housekeepingQueue);
    if (isErr(registered)) throw toPipelineError(registered.error);
  }

  const services = await createServiceSet(adapters, { cdnBaseUrl, rawBucket, limits });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (req) => rateLimitProblem(req.url),
  });

  registerErrorHandler(app);

  await app.register(registerAuth, {
    channelService: services.channelService,
    ...(options.jwksUrl ? { jwksUrl: options.jwksUrl } : {}),
  });
  await app.register(registerHttpMetricsPlugin);
  await registerOpenApi(app);

  registerHealthRoutes(app, {
    dbClient: adapters.dbClient,
    cache: adapters.cache,
    storage: adapters.storage,
  });
  registerDevJwksRoute(app);
  registerUploadsRoutes(app, {
    uploadService: services.uploadService,
    ...(limits.rateLimitMax === undefined ? {} : { rateLimitMax: limits.rateLimitMax }),
    ...(limits.maxUploadBytes === undefined ? {} : { maxUploadBytes: limits.maxUploadBytes }),
  });
  registerVideosRoutes(app, { videoService: services.videoService });
  registerReactionsRoutes(app, { reactionService: services.reactionService });
  registerFeedRoutes(app, { feedService: services.feedService });
  registerCategoriesRoutes(app, { categoryService: services.categoryService });
  registerAdminCategoriesRoutes(app, { categoryService: services.categoryService });
  registerAdminVideosRoutes(app, { videoService: services.videoService });
  registerMeRoutes(app, { channelService: services.channelService });
  registerChannelsRoutes(app, { channelService: services.channelService });
  registerSubscriptionsRoutes(app, { subscriptionService: services.subscriptionService });
  registerEventsRoutes(app, { sseHub: services.sseHub, sseService: services.sseService });
  await registerAdminQueuesRoutes(app, { queueService: services.queueService });
  registerAdminDlqRoutes(app, { dlqService: services.dlqService });

  const metrics = getMetrics();
  const queuePoller = startQueuePoller({ queues: adapters.queues, metrics });
  const sqlPoller = startSqlPoller({ repositories: adapters.repositories, metrics });

  app.addHook('onClose', async () => {
    await adapters.categoryCache.close();
    await services.sseHub.close();
    queuePoller.stop();
    sqlPoller.stop();
  });

  return app;
}
