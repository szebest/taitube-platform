import type { FastifyInstance } from 'fastify';
import {
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '../../packages/server/adapters/index';
import { buildApp } from '../../apps/api/src/app';
import { createWorkerRunner } from '../../apps/worker/src/runner';
import { runReconcileUploads } from '../../apps/worker/src/stages/housekeeping/reconcile-uploads';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  Repositories,
  StorageClient,
} from '../../packages/server/core/ports/index';
import { createLogger, createMetricsRegistry } from '../../packages/server/observability/src/index';
import { startMockS3Server } from './s3-mock-server';

export interface InProcessEnv {
  app: FastifyInstance;
  apiUrl: string;
  s3BaseUrl: string;
  repositories: Repositories;
  storage: StorageClient;
  multipart: MultipartStorage;
  cache: CacheClient;
  queuesMap: Map<string, JobQueue>;
  flowProducer: FlowProducerPort;
  teardown: () => Promise<void>;
}

export async function setupInProcessEnv(): Promise<InProcessEnv> {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  const cache = new InMemoryCacheClient();

  const queuesMap = new Map<string, JobQueue>();
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

  const getQueue = (name: string): JobQueue => {
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
  ];
  const logger = createLogger({ service: 'e2e-worker', level: 'warn' });
  const metrics = createMetricsRegistry({ env: 'test' });

  for (const stage of workerStages) {
    const runner = await createWorkerRunner({
      stage,
      repositories,
      storage,
      multipart,
      cache,
      jobQueue: queuesMap.get(stage),
      getQueue,
      flowProducer,
      logger,
      metrics,
      workerId: `e2e-worker-${stage}`,
    });
    workerClosers.push(runner.close);
  }

  const app = await buildApp({
    adapters: {
      repositories,
      storage,
      multipart,
      cache,
      probeQueue: queuesMap.get('probe'),
      queues: queuesMap,
    },
    limits: {
      multipartThresholdBytes: 8 * 1024 * 1024,
      sseHeartbeatMs: 2000,
      maxInflightPerUser: 100,
    },
    rawBucket: 'raw',
    cdnBaseUrl: `${s3Instance.baseUrl}/public`,
  });

  const reconcilerTimer = setInterval(() => {
    runReconcileUploads({
      repositories,
      multipart,
      probeQueue: queuesMap.get('probe'),
      maxInflightPerUser: 100,
      uploadedThresholdMs: 500,
    }).catch(() => {});
  }, 1000);
  workerClosers.push(async () => clearInterval(reconcilerTimer));

  const apiUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  console.log(
    `[e2e-runner] In-process environment ready. API: ${apiUrl}, S3: ${s3Instance.baseUrl}`
  );

  const teardown = async (): Promise<void> => {
    for (const closeWorker of workerClosers) await closeWorker().catch(() => {});
    await app.close().catch(() => {});
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
