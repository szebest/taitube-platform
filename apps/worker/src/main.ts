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
import { registeredTracing } from '@vp/observability';
import { LogContext, type Logger, createLogger } from '@vp/logger';
import { ignore, isErr } from '@vp/result';
import { STAGE_REGISTRY } from './registry';
import { type WorkerRunner, composeWorker } from './runner';

export interface WorkerProcess {
  runner: WorkerRunner;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

export async function main(host: ProcessHost): Promise<WorkerProcess> {
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

/** `log` is for a start that fails before the worker has a logger of its own. */
export function run(host: ProcessHost, log: Logger): Promise<void> {
  return main(host).then(
    () => undefined,
    (err) => {
      log.fatal({ err }, 'worker could not start');
      host.exit(1);
    }
  );
}

if (process.env['NODE_ENV'] !== 'test') {
  const host: ProcessHost = {
    env: process.env,
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
  };
  void run(host, createLogger({ service: 'vp-worker', level: 'info', format: 'json' }));
}
