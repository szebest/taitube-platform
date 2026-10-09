import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container, DisposeFailed, type StartupFailed } from '@vp/composition';
import type {
  CacheClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  StorageClient,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { MediaTools } from '@vp/ffmpeg';
import type { LogContext, Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, isErr, ok } from '@vp/result';
import { Worker, registerStages, resolveStartOrder } from './composition/stages.module';
import type { OutboxRelay } from './stages/housekeeping/outbox-relay';

interface WorkerAdapterOverrides {
  repositories?: Repositories;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  cache?: CacheClient;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  jobQueue?: JobQueue;
  metrics?: PipelineMetrics;
}

export interface WorkerRunnerOptions {
  config: AppConfig;
  logger: Logger;
  logContext: LogContext;
  media: MediaTools;
  workerId: string;
  adapters?: WorkerAdapterOverrides;
  disableOutboxRelay?: boolean;
}

export interface WorkerRunner {
  queue: JobQueue;
  worker: { name: string };
  outboxRelay?: OutboxRelay;
  metricsPort: () => number;
  start: () => Promise<Result<void, StartupFailed>>;
  started: () => readonly string[];
  close: () => Promise<void>;
  disposing: () => string | undefined;
}

function overrideAdapters(c: Container, overrides: WorkerAdapterOverrides = {}): Container {
  const { repositories, storage, multipart, cache, getQueue, flowProducer, jobQueue, metrics } =
    overrides;
  if (repositories) c.override(Adapters.Repositories, repositories);
  if (storage) c.override(Adapters.Storage, storage);
  if (multipart) c.override(Adapters.Multipart, multipart);
  if (cache) c.override(Adapters.Cache, cache);
  if (flowProducer) c.override(Adapters.FlowProducer, flowProducer);
  if (metrics) c.override(Adapters.Metrics, metrics);
  if (getQueue) c.override(Adapters.QueueRegistry, { get: getQueue, close: async () => ok() });
  if (jobQueue) c.override(Worker.ConsumeQueue, jobQueue);
  return c;
}

/**
 * Composes one stage over the adapter family its configuration names, and starts nothing, so the
 * caller can install its signal handlers before the first start runs.
 */
export async function composeWorker(options: WorkerRunnerOptions): Promise<WorkerRunner> {
  const { config, logger } = options;

  const container = overrideAdapters(
    await registerAdapters(new Container(), config),
    options.adapters
  );
  registerStages(container, {
    logger,
    logContext: options.logContext,
    workerId: options.workerId,
    media: options.media,
    outboxRelay: { enabled: !options.disableOutboxRelay },
  });
  resolveStartOrder(container);

  const { queue } = container.get(Worker.Consumer);
  const metricsServer = container.get(Worker.MetricsServer);

  return {
    queue,
    worker: { name: container.get(Worker.Stage).queue },
    outboxRelay: container.get(Worker.OutboxRelay),
    metricsPort: () => metricsServer.port,
    start: async () => {
      const started = await container.start();
      if (isErr(started) && started.error.type === 'failed') {
        logger.error({ token: started.error.token, cause: started.error.cause }, 'startup failed');
      }
      return started;
    },
    started: () => container.started(),
    close: async () => {
      logger.info('shutting down worker...');
      const disposed = await container.dispose();
      if (isErr(disposed)) throw new DisposeFailed(disposed.error);
    },
    disposing: () => container.disposing(),
  };
}
