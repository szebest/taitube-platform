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
import { type AnyFailure, toPipelineError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import type { Logger, PipelineMetrics } from '@vp/observability';
import { type Result, assertNever, isErr, ok } from '@vp/result';
import { Worker, registerStages, resolveStartOrder } from './composition/stages.module';
import type { OutboxRelay } from './stages/housekeeping/outbox-relay';

export interface WorkerAdapterOverrides {
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
        logger.error({ token: started.error.token, cause: started.error.cause }, 'Startup failed');
      }
      return started;
    },
    started: () => container.started(),
    close: async () => {
      logger.info('Shutting down worker...');
      const disposed = await container.dispose();
      if (isErr(disposed)) throw new DisposeFailed(disposed.error);
    },
    disposing: () => container.disposing(),
  };
}

/** Composes and starts in one call, for a caller with no signals to install first. */
export async function createWorkerRunner(options: WorkerRunnerOptions): Promise<WorkerRunner> {
  const runner = await composeWorker(options);
  const started = await runner.start();
  if (!isErr(started)) return runner;

  switch (started.error.type) {
    case 'failed': {
      const { cause } = started.error;
      throw cause instanceof Error ? cause : toPipelineError(cause as AnyFailure);
    }
    case 'interrupted':
      return runner;
    default:
      return assertNever(started.error, 'StartupFailed');
  }
}
