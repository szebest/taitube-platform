import {
  BullMqFlowProducer,
  BullMqJobQueue,
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  PostgresRepositories,
  RedisCacheClient,
  S3MultipartStorage,
  S3StorageClient,
} from '@vp/adapters';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  StorageClient,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  type Logger,
  type PipelineMetrics,
  createLogger,
  getMetrics,
  initTracing,
  startMetricsServer,
} from '@vp/observability';
import { getWorkerStage } from './config';
import { createFailureHandler } from './failure-handler';
import { STAGE_REGISTRY, validateQueueName } from './registry';
import { OutboxRelay, createHousekeepingProcessor } from './stages/housekeeping/index';
import { createNotifyProcessor } from './stages/notify';
import { createPackageProcessor } from './stages/package';
import { createProbeProcessor } from './stages/probe';
import { createThumbnailProcessor } from './stages/thumbnail';
import { createTranscodeProcessor } from './stages/transcode';
import { withTelemetry } from './with-telemetry';

export interface WorkerRunnerOptions {
  stage?: string;
  repositories?: Repositories;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  cache?: CacheClient;
  jobQueue?: JobQueue;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  logger?: Logger;
  metrics?: PipelineMetrics;
  metricsPort?: number;
  workerId?: string;
  heartbeatPath?: string;
  outboxRelayIntervalMs?: number;
  disableOutboxRelay?: boolean;
}

export interface WorkerRunner {
  queue: JobQueue;
  worker: { name: string };
  metricsServer?: { port: number; close: () => Promise<void> };
  outboxRelay?: OutboxRelay;
  close: () => Promise<void>;
}

export async function createWorkerRunner(options: WorkerRunnerOptions = {}): Promise<WorkerRunner> {
  const stage = options.stage || getWorkerStage();
  const config = STAGE_REGISTRY[stage];
  if (!config) {
    throw new Error(`Unknown WORKER_STAGE: "${stage}"`);
  }

  validateQueueName(config.queue);

  initTracing({ serviceName: `vp-worker-${stage}` });

  const logger =
    options.logger ||
    createLogger({
      service: `worker-${stage}`,
      bindings: { stage },
    });

  const isInMemory =
    options.jobQueue instanceof InMemoryJobQueue ||
    options.repositories instanceof InMemoryRepositories ||
    process.env['NODE_ENV'] === 'test';

  const metrics = options.metrics || getMetrics();
  const repositories =
    options.repositories || (isInMemory ? new InMemoryRepositories() : new PostgresRepositories());
  const storage =
    options.storage || (isInMemory ? new InMemoryStorageClient() : new S3StorageClient());
  const multipart =
    options.multipart ||
    (isInMemory
      ? new InMemoryMultipartStorage(storage)
      : new S3MultipartStorage({
          storageClient: storage instanceof S3StorageClient ? storage : undefined,
        }));
  const cache = options.cache || (isInMemory ? new InMemoryCacheClient() : new RedisCacheClient());

  const queues = new Map<string, JobQueue>();
  const getQueue: (name: string) => JobQueue =
    options.getQueue ??
    ((name: string): JobQueue => {
      let q = queues.get(name);
      if (!q) {
        q = isInMemory ? new InMemoryJobQueue(name) : new BullMqJobQueue({ name });
        queues.set(name, q);
      }
      return q;
    });

  const flowProducer =
    options.flowProducer ||
    (isInMemory ? new InMemoryFlowProducer(getQueue) : new BullMqFlowProducer());

  let processor: Parameters<JobQueue['process']>[0];
  if (stage === 'probe') {
    processor = createProbeProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
      getQueue,
      flowProducer,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else if (stage.startsWith('transcode-')) {
    processor = createTranscodeProcessor({
      repositories,
      storage,
      cache,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
      getQueue,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else if (stage === 'thumbnail') {
    processor = createThumbnailProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else if (stage === 'package') {
    processor = createPackageProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      getQueue,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else if (stage === 'notify') {
    processor = createNotifyProcessor({
      repositories,
      cache,
      workerId: options.workerId,
      logger,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else if (stage === 'housekeeping') {
    processor = createHousekeepingProcessor({
      repositories,
      storage,
      multipart,
      getQueue,
      workerId: options.workerId,
      logger,
    }) as unknown as Parameters<JobQueue['process']>[0];
  } else {
    throw new Error(`Stage "${stage}" processor not implemented yet`);
  }

  const queue: JobQueue = options.jobQueue ?? getQueue(config.queue);

  if (queue.onFailed) {
    const onFailedHandler = createFailureHandler({
      stage,
      queueName: config.queue,
      repositories,
      getQueue,
      logger,
      metrics,
      workerId: options.workerId,
    });
    queue.onFailed(onFailedHandler);
  }

  const instrumentedProcessor = withTelemetry(config.queue, async (job) => {
    const startTime = Date.now();
    metrics.bullmqQueueJobs.set({ queue: config.queue, state: 'active' }, 1);

    const enqueuedAt =
      (job as unknown as { timestamp?: number }).timestamp ??
      (job.opts as { timestamp?: number } | undefined)?.timestamp;
    if (enqueuedAt && enqueuedAt > 0) {
      const waitSec = Math.max(0, (startTime - enqueuedAt) / 1000);
      metrics.jobWaitDuration.observe({ queue: config.queue }, waitSec);
    }

    try {
      const result = await processor(job);
      const durationSec = (Date.now() - startTime) / 1000;
      metrics.jobDuration.observe({ queue: config.queue }, durationSec);
      metrics.jobsProcessed.inc({ queue: config.queue, result: 'completed' });
      return result;
    } catch (err) {
      const durationSec = (Date.now() - startTime) / 1000;
      metrics.jobDuration.observe({ queue: config.queue }, durationSec);
      metrics.jobsProcessed.inc({ queue: config.queue, result: 'failed' });
      throw err;
    }
  });

  queue.process(instrumentedProcessor as unknown as Parameters<JobQueue['process']>[0], {
    concurrency: config.concurrency,
    lockDurationMs: config.lockDurationMs,
    lockRenewTimeMs: config.lockRenewTimeMs,
    stalledIntervalMs: config.stalledIntervalMs,
    maxStalledCount: config.maxStalledCount,
  });

  let metricsServer: { port: number; close: () => Promise<void> } | undefined;
  if (options.metricsPort !== undefined) {
    try {
      metricsServer = await startMetricsServer({
        port: options.metricsPort,
        registry: metrics.registry,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to start worker metrics server');
    }
  }

  let outboxRelay: OutboxRelay | undefined;
  if (stage === 'housekeeping' && !options.disableOutboxRelay) {
    const relayIntervalMs =
      options.outboxRelayIntervalMs ??
      (process.env['OUTBOX_RELAY_INTERVAL_MS']
        ? Number.parseInt(process.env['OUTBOX_RELAY_INTERVAL_MS'], 10)
        : 1000);

    outboxRelay = new OutboxRelay({
      repositories,
      getQueue,
      flowProducer,
      logger,
      metrics,
      intervalMs: relayIntervalMs,
    });
    outboxRelay.start();
  }

  const close = async () => {
    logger.info('Shutting down worker...');
    if (outboxRelay) {
      await outboxRelay.stop().catch(() => {});
    }
    if (metricsServer) {
      await metricsServer.close().catch(() => {});
    }
    await flowProducer.close().catch(() => {});
    await queue.close();
    for (const q of queues.values()) {
      if (q !== queue) {
        await q.close().catch(() => {});
      }
    }
  };

  return {
    queue,
    worker: { name: config.queue },
    metricsServer,
    outboxRelay,
    close,
  };
}
