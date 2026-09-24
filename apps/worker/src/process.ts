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
import { createLogger, initTracing } from '@vp/observability';
import { fromPromise, ignore, isErr } from '@vp/result';
import { STAGE_REGISTRY } from './registry';
import { type WorkerRunner, composeWorker } from './runner';

interface WorkerProcess {
  runner: WorkerRunner;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

async function start(host: ProcessHost): Promise<WorkerProcess> {
  const config = toAppConfig(loadEnv(host.env, { exitOnError: false }));
  const { stage } = config.worker;

  const tracing = initTracing({ serviceName: `vp-worker-${stage}`, ...config.otel });
  if (isErr(tracing)) console.warn(`[worker] tracing disabled: ${tracing.error.message}`);

  const runner = await composeWorker({
    config,
    logger: createLogger({
      service: `worker-${stage}`,
      level: config.logLevel,
      bindings: { stage },
    }),
    media: mediaTools,
    workerId: `worker-${process.pid}`,
  });

  const shutdown = shutdownOnce({
    drain: () => {},
    drainDelayMs: 0,
    close: async () => {
      await runner.close();
      if (tracing.ok) {
        ignore(
          await tracing.value.shutdown(),
          'spans that could not be flushed are lost either way; the close is what decides the exit'
        );
      }
    },
    graceMs: STAGE_REGISTRY[stage].shutdownTimeoutMs,
    pending: () => runner.disposing(),
    log: (message) => console.log(`[worker] ${message}`),
  });

  exitOnSignals(host, shutdown);

  const started = await runner.start();
  if (isErr(started) && started.error.type === 'failed') throw asThrowable(started.error.cause);

  console.log(`[worker] Started ${runner.started().join(', ')}; consuming "${runner.worker.name}"`);
  console.log(`[worker] Metrics on http://0.0.0.0:${runner.metricsPort()}/metrics`);
  return { runner, metricsPort: runner.metricsPort(), shutdown };
}

/** Resolves to `undefined` once a fatal boot error has asked the host to exit 1. */
export async function run(host: ProcessHost): Promise<WorkerProcess | undefined> {
  const started = await fromPromise(
    () => start(host),
    (cause) => cause
  );
  if (isErr(started)) {
    console.error('Fatal worker error:', started.error);
    host.exit(1);
    return undefined;
  }
  return started.value;
}
