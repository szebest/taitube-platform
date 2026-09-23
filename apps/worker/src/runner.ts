import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container, DisposeFailed } from '@vp/composition';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  StorageClient,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import { type AnyFailure, toPipelineError } from '@vp/errors';
import {
  type Logger,
  type PipelineMetrics,
  createLogger,
  getMetrics,
  initTracing,
  shutdownTracing,
} from '@vp/observability';
import { isErr, ok } from '@vp/result';
import { Worker, registerStages } from './composition/stages.module';
import type { OutboxRelay } from './stages/housekeeping/outbox-relay';

export interface WorkerAdapterOverrides {
  repositories?: Repositories;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  cache?: CacheClient;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  jobQueue?: JobQueue;
}

export interface WorkerRunnerOptions {
  config?: AppConfig;
  adapters?: WorkerAdapterOverrides;
  logger?: Logger;
  metrics?: PipelineMetrics;
  workerId?: string;
  outboxRelayIntervalMs?: number;
  disableOutboxRelay?: boolean;
}

export interface WorkerRunner {
  queue: JobQueue;
  worker: { name: string };
  outboxRelay?: OutboxRelay;
  close: () => Promise<void>;
  disposing: () => string | undefined;
}

function overrideAdapters(c: Container, overrides: WorkerAdapterOverrides = {}): Container {
  const { repositories, storage, multipart, cache, getQueue, flowProducer, jobQueue } = overrides;
  if (repositories) c.override(Adapters.Repositories, repositories);
  if (storage) c.override(Adapters.Storage, storage);
  if (multipart) c.override(Adapters.Multipart, multipart);
  if (cache) c.override(Adapters.Cache, cache);
  if (flowProducer) c.override(Adapters.FlowProducer, flowProducer);
  if (getQueue) c.override(Adapters.QueueRegistry, { get: getQueue, close: async () => ok() });
  if (jobQueue) c.override(Worker.ConsumeQueue, jobQueue);
  return c;
}

/** Composes one stage over the adapter family its configuration names, and starts consuming. */
export async function createWorkerRunner(options: WorkerRunnerOptions = {}): Promise<WorkerRunner> {
  const config = options.config ?? inProcessAppConfig();
  const { stage } = config.worker;
  initTracing({ serviceName: `vp-worker-${stage}`, ...config.otel });

  const logger =
    options.logger ??
    createLogger({ service: `worker-${stage}`, level: config.logLevel, bindings: { stage } });

  const container = overrideAdapters(
    await registerAdapters(new Container(), config),
    options.adapters
  );
  registerStages(container, {
    logger,
    metrics: options.metrics ?? getMetrics(),
    workerId: options.workerId,
    outboxRelay: {
      enabled: !options.disableOutboxRelay,
      intervalMs: options.outboxRelayIntervalMs ?? 1000,
    },
  });

  const { queue } = container.get(Worker.Consumer);
  const outboxRelay = container.get(Worker.OutboxRelay);

  const started = await container.start();
  if (isErr(started)) {
    logger.error({ token: started.error.token, cause: started.error.cause }, 'Startup failed');
    throw toPipelineError(started.error.cause as AnyFailure);
  }

  return {
    queue,
    worker: { name: container.get(Worker.Stage).queue },
    outboxRelay,
    close: async () => {
      logger.info('Shutting down worker...');
      const disposed = await container.dispose();
      await shutdownTracing();
      if (isErr(disposed)) throw new DisposeFailed(disposed.error);
    },
    disposing: () => container.disposing(),
  };
}
