import {
  BullMqFlowProducer,
  BullMqJobQueue,
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
  PostgresRepositories,
  RedisCacheClient,
  S3StorageClient,
} from '@vp/adapters';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  QueueJob,
  Repositories,
  StorageClient,
} from '@vp/core/ports';
import {
  type Logger,
  type PipelineMetrics,
  createLogger,
  getMetrics,
  initTracing,
} from '@vp/observability';
import { STAGE_REGISTRY, validateQueueName } from './registry.js';
import { createNotifyProcessor } from './stages/notify.js';
import { createPackageProcessor } from './stages/package.js';
import { createProbeProcessor } from './stages/probe.js';
import { createThumbnailProcessor } from './stages/thumbnail.js';
import { createTranscodeProcessor } from './stages/transcode.js';

export interface WorkerRunnerOptions {
  stage?: string;
  repositories?: Repositories;
  storage?: StorageClient;
  cache?: CacheClient;
  jobQueue?: JobQueue;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  logger?: Logger;
  metrics?: PipelineMetrics;
  workerId?: string;
  heartbeatPath?: string;
}

export interface WorkerRunner {
  queue: JobQueue;
  worker: { name: string };
  close: () => Promise<void>;
}

export function createWorkerRunner(options: WorkerRunnerOptions = {}): WorkerRunner {
  const stage = options.stage || process.env['WORKER_STAGE'] || 'probe';
  const config = STAGE_REGISTRY[stage];
  if (!config) {
    throw new Error(`Unknown WORKER_STAGE: "${stage}"`);
  }

  // Validate queue name (AC 22)
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
    options.jobQueue?.constructor.name === 'InMemoryJobQueue' ||
    options.repositories instanceof InMemoryRepositories ||
    options.repositories?.constructor.name === 'InMemoryRepositories' ||
    process.env['NODE_ENV'] === 'test';

  const metrics = options.metrics || getMetrics();
  const repositories =
    options.repositories || (isInMemory ? new InMemoryRepositories() : new PostgresRepositories());
  const storage =
    options.storage || (isInMemory ? new InMemoryStorageClient() : new S3StorageClient());
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

  // Processor selection based on stage
  let processor: (job: QueueJob<any>) => Promise<unknown>;
  if (stage === 'probe') {
    processor = createProbeProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
      getQueue,
      flowProducer,
    });
  } else if (stage.startsWith('transcode-')) {
    processor = createTranscodeProcessor({
      repositories,
      storage,
      cache,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
      getQueue,
    });
  } else if (stage === 'thumbnail') {
    processor = createThumbnailProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
    });
  } else if (stage === 'package') {
    processor = createPackageProcessor({
      repositories,
      storage,
      workerId: options.workerId,
      logger,
      getQueue,
    });
  } else if (stage === 'notify') {
    processor = createNotifyProcessor({
      repositories,
      cache,
      workerId: options.workerId,
      logger,
    });
  } else {
    throw new Error(`Stage "${stage}" processor not implemented yet`);
  }

  const queue: JobQueue = options.jobQueue ?? getQueue(config.queue);

  if (stage === 'package' && queue.onFailed) {
    queue.onFailed(async (job, err) => {
      const videoId = (job.data as any)?.videoId;
      if (videoId) {
        logger.error(
          { videoId, err: err.message },
          'Package job failed; transitioning video to FAILED'
        );
        const errorCode = (err as any)?.code || 'TRANSCODE_FAILED';
        await repositories.videos
          .transition({
            videoId,
            from: 'PROCESSING',
            to: 'FAILED',
            eventType: 'video.failed',
            eventPayload: { errorCode, errorMessage: err.message },
            patch: { errorCode, errorMessage: err.message },
          })
          .catch(() => {});
      }
    });
  }

  queue.process(
    async (job) => {
      const startTime = Date.now();
      metrics.bullmqQueueJobs.set({ queue: config.queue, state: 'active' }, 1);

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
    },
    {
      concurrency: config.concurrency,
      lockDurationMs: config.lockDurationMs,
      lockRenewTimeMs: config.lockRenewTimeMs,
      stalledIntervalMs: config.stalledIntervalMs,
      maxStalledCount: config.maxStalledCount,
    }
  );

  const close = async () => {
    logger.info('Shutting down worker...');
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
    close,
  };
}
