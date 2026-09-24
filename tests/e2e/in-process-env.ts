import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../apps/api/src/app';
import { composeWorker } from '../../apps/worker/src/runner';
import { runReconcileUploads } from '../../apps/worker/src/stages/housekeeping/reconcile-uploads';
import {
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '../../packages/server/adapters/in-memory/index';
import type {
  CacheClient,
  FlowProducerPort,
  MultipartStorage,
  Repositories,
  StorageClient,
} from '../../packages/server/core/ports/index';
import { inProcessAppConfig } from '../../packages/server/env-schema/src/index';
import { mediaTools } from '../../packages/server/ffmpeg/src/index';
import { LogContext, type Logger, createLogger } from '../../packages/server/logger/src/index';
import { createMetricsRegistry } from '../../packages/server/observability/src/index';
import { startMockS3Server } from './s3-mock-server';

export interface InProcessEnv {
  app: FastifyInstance;
  apiUrl: string;
  s3BaseUrl: string;
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  cache: CacheClient;
  queuesMap: Map<string, InMemoryJobQueue>;
  flowProducer: FlowProducerPort;
  teardown: () => Promise<void>;
}

export async function setupInProcessEnv(log: Logger): Promise<InProcessEnv> {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  const cache = new InMemoryCacheClient();

  const queuesMap = new Map<string, InMemoryJobQueue>();
  const queueNames = [
    'probe',
    'transcode-1080p',
    'transcode-720p',
    'transcode-480p',
    'thumbnail',
    'package',
    'notify',
    'housekeeping',
    'dlq',
  ];
  for (const q of queueNames) queuesMap.set(q, new InMemoryJobQueue(q));

  const getQueue = (name: string): InMemoryJobQueue => {
    let q = queuesMap.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queuesMap.set(name, q);
    }
    return q;
  };
  const flowProducer = new InMemoryFlowProducer(getQueue);

  const s3Instance = await startMockS3Server({ storage, multipart });
  const workerClosers: Array<() => Promise<void>> = [];

  const workerStages = [
    'probe',
    'transcode-1080p',
    'transcode-720p',
    'transcode-480p',
    'thumbnail',
    'package',
    'notify',
    'housekeeping',
  ] as const;
  const logContext = new LogContext();
  const logger = createLogger({
    format: 'json',
    service: 'e2e-worker',
    level: 'warn',
    context: logContext,
  });
  const metrics = createMetricsRegistry();

  for (const stage of workerStages) {
    const runner = await composeWorker({
      config: inProcessAppConfig({ cdn: `${s3Instance.baseUrl}/public`, worker: { stage } }),
      adapters: {
        repositories,
        storage,
        multipart,
        cache,
        jobQueue: queuesMap.get(stage),
        getQueue,
        flowProducer,
        metrics,
      },
      logger,
      logContext,
      media: mediaTools,
      workerId: `e2e-worker-${stage}`,
    });
    const started = await runner.start();
    if (!started.ok) throw new Error(`the ${stage} worker did not start`, { cause: started.error });
    workerClosers.push(runner.close);
  }

  const app = (
    await composeApp({
      adapters: {
        repositories,
        storage,
        multipart,
        cache,
        probeQueue: getQueue('probe'),
        queues: queuesMap,
      },
      config: inProcessAppConfig({
        cdn: `${s3Instance.baseUrl}/public`,
        limits: { multipartThresholdBytes: 8 * 1024 * 1024, maxInflightPerUser: 100 },
        sse: { heartbeatMs: 2000 },
      }),
    })
  ).app;

  const reconcilerTimer = setInterval(() => {
    runReconcileUploads({
      rawBucket: 'raw',
      repositories,
      multipart,
      probeQueue: getQueue('probe'),
      maxInflightPerUser: 100,
      uploadedThresholdMs: 500,
      scanLimit: 100,
    }).catch(() => {});
  }, 1000);
  workerClosers.push(async () => clearInterval(reconcilerTimer));

  const apiUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  log.info({ apiUrl, s3BaseUrl: s3Instance.baseUrl }, 'in-process environment ready');

  const teardown = async (): Promise<void> => {
    for (const closeWorker of workerClosers) await closeWorker().catch(() => {});
    await app.close().catch(() => {});
    for (const queue of queuesMap.values()) await queue.close();
    await s3Instance.close().catch(() => {});
  };

  return {
    app,
    apiUrl,
    s3BaseUrl: s3Instance.baseUrl,
    repositories,
    storage,
    multipart,
    cache,
    queuesMap,
    flowProducer,
    teardown,
  };
}
