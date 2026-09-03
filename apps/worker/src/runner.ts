import { type Database, createDbClient } from '@vp/db';
import {
  type Logger,
  type PipelineMetrics,
  createLogger,
  getMetrics,
  initTracing,
} from '@vp/observability';
import { type S3Client, createStorageClient } from '@vp/storage';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { STAGE_REGISTRY, validateQueueName } from './registry.js';
import { createProbeProcessor } from './stages/probe.js';

export interface WorkerRunnerOptions {
  stage?: string;
  db?: Database;
  s3Client?: S3Client;
  redisConnection?: Redis;
  logger?: Logger;
  metrics?: PipelineMetrics;
  workerId?: string;
  heartbeatPath?: string;
}

export interface WorkerRunner {
  worker: Worker;
  close: () => Promise<void>;
}

export function createWorkerRunner(options: WorkerRunnerOptions = {}): WorkerRunner {
  const stage = options.stage || process.env.WORKER_STAGE || 'probe';
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

  const metrics = options.metrics || getMetrics();
  const db = options.db || createDbClient().db;
  const s3Client = options.s3Client || createStorageClient();

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const connection =
    options.redisConnection ||
    new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

  // Processor selection based on stage
  let processor: (job: Job) => Promise<unknown>;
  if (stage === 'probe') {
    processor = createProbeProcessor({
      db,
      s3Client,
      workerId: options.workerId,
      logger,
      heartbeatPath: options.heartbeatPath,
    });
  } else {
    throw new Error(`Stage "${stage}" processor not implemented yet`);
  }

  // BullMQ Worker initialization matching SDD §9.1 and §9.4
  const worker = new Worker(
    config.queue,
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
      connection,
      prefix: 'bull',
      concurrency: config.concurrency,
      lockDuration: config.lockDurationMs,
      lockRenewTime: config.lockRenewTimeMs,
      stalledInterval: config.stalledIntervalMs,
      maxStalledCount: config.maxStalledCount,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
      'Job failed'
    );
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled');
    metrics.jobsProcessed.inc({ queue: config.queue, result: 'stalled' });
  });

  const close = async () => {
    logger.info('Shutting down worker...');
    await worker.close();
    if (!options.redisConnection) {
      await connection.quit().catch(() => {});
    }
  };

  return {
    worker,
    close,
  };
}
