import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../apps/server/api/src/app';
import { composeWorker } from '../../apps/server/worker/src/runner';
import { runReconcileUploads } from '../../apps/server/worker/src/stages/housekeeping/reconcile-uploads';
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
  StorageClient,
} from '../../packages/server/core/ports/index';
import type { Repositories } from '../../packages/server/core/repositories/index';
import { inProcessAppConfig } from '../../packages/server/env-schema/src/index';
import { mediaTools } from '../../packages/server/ffmpeg/src/index';
import { QUEUES } from '../../packages/server/job-contracts/src/index';
import { LogContext, type Logger, createLogger } from '../../packages/server/logger/src/index';
import { createMetricsRegistry } from '../../packages/server/observability/src/index';
import { fromPromise, ignore } from '../../packages/universal/result/src/index';
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

const MAX_INFLIGHT_PER_USER = 100;

export interface InProcessEnvOptions {
  apiPort?: number;
  s3Port?: number;
  corsOrigins?: string[];
}

export async function setupInProcessEnv(
  log: Logger,
  { apiPort = 0, s3Port = 0, corsOrigins }: InProcessEnvOptions = {}
): Promise<InProcessEnv> {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  const cache = new InMemoryCacheClient();

  const queuesMap = new Map<string, InMemoryJobQueue>();
  for (const q of QUEUES) queuesMap.set(q, new InMemoryJobQueue(q));

  const getQueue = (name: string): InMemoryJobQueue => {
    let q = queuesMap.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queuesMap.set(name, q);
    }
    return q;
  };
  const flowProducer = new InMemoryFlowProducer(getQueue);

  const s3Instance = await startMockS3Server({ storage, multipart, port: s3Port });
  const workerClosers: Array<() => Promise<void>> = [];

  const workerStages = QUEUES.filter((queue) => queue !== 'dlq');
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
        limits: {
          multipartThresholdBytes: 8 * 1024 * 1024,
          maxInflightPerUser: MAX_INFLIGHT_PER_USER,
        },
        sse: { heartbeatMs: 2000 },
        http: { corsOrigins },
      }),
    })
  ).app;

  const reconcilerTimer = setInterval(() => {
    ignore(
      runReconcileUploads({
        rawBucket: 'raw',
        repositories,
        multipart,
        probeQueue: getQueue('probe'),
        metrics,
        maxInflightPerUser: MAX_INFLIGHT_PER_USER,
        uploadingThresholdMs: 60 * 60 * 1000,
        uploadedThresholdMs: 500,
        scanLimit: 100,
      }),
      'the next tick retries a pass the database refused'
    );
  }, 1000);
  workerClosers.push(async () => clearInterval(reconcilerTimer));

  const apiUrl = await app.listen({ port: apiPort, host: '127.0.0.1' });
  log.info({ apiUrl, s3BaseUrl: s3Instance.baseUrl }, 'in-process environment ready');

  const teardown = async (): Promise<void> => {
    const gone = (cause: unknown) => cause;
    for (const closeWorker of workerClosers) {
      ignore(await fromPromise(closeWorker, gone), 'the stack is going away');
    }
    ignore(await fromPromise(app.close(), gone), 'the stack is going away');
    for (const queue of queuesMap.values()) await queue.close();
    ignore(await fromPromise(s3Instance.close(), gone), 'the stack is going away');
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
