import {
  type ProcessHost,
  type ShutdownOutcome,
  exitOnSignals,
  shutdownOnce,
} from '@vp/composition';
import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { asThrowable } from '@vp/errors';
import { mediaTools } from '@vp/ffmpeg';
import { LogContext, type Logger, createLogger } from '@vp/logger';
import { registeredTracing } from '@vp/observability';
import { fromPromise, ignore, isErr } from '@vp/result';
import { STAGE_REGISTRY } from './registry';
import { type WorkerRunner, composeWorker } from './runner';

interface WorkerProcess {
  runner: WorkerRunner;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

async function start(host: ProcessHost): Promise<WorkerProcess> {
  const config = toAppConfig(loadEnv(host.env));
  const { stage } = config.worker;
  const logContext = new LogContext();
  const logger = createLogger({
    format: 'json',
    service: `worker-${stage}`,
    level: config.logLevel,
    bindings: { stage },
    context: logContext,
  });

  const runner = await composeWorker({
    config,
    logger,
    logContext,
    media: mediaTools,
    workerId: `worker-${process.pid}`,
  });

  const shutdown = shutdownOnce({
    drain: () => {},
    drainDelayMs: 0,
    close: async () => {
      await runner.close();
      ignore(
        await registeredTracing.shutdown(),
        'spans that could not be flushed are lost either way; the close is what decides the exit'
      );
    },
    graceMs: STAGE_REGISTRY[stage].shutdownTimeoutMs,
    pending: () => runner.disposing(),
    log: logger,
  });

  exitOnSignals(host, shutdown);

  const started = await runner.start();
  if (isErr(started) && started.error.type === 'failed') throw asThrowable(started.error.cause);

  logger.info(
    { started: runner.started(), queue: runner.worker.name, metricsPort: runner.metricsPort() },
    'worker consuming'
  );
  return { runner, metricsPort: runner.metricsPort(), shutdown };
}

/**
 * `log` is for a start that fails before the worker has a logger of its own. Resolves to
 * `undefined` once a fatal boot error has asked the host to exit 1.
 */
export async function run(host: ProcessHost, log: Logger): Promise<WorkerProcess | undefined> {
  const started = await fromPromise(
    () => start(host),
    (cause) => cause
  );
  if (isErr(started)) {
    log.fatal({ err: started.error }, 'worker could not start');
    host.exit(1);
    return undefined;
  }
  return started.value;
}
