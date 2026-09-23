import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type ShutdownOutcome, shutdownOnce } from '@vp/composition';
import { loadEnv } from '@vp/config';
import { toAppConfig } from '@vp/env-schema';
import { getMetrics, startMetricsServer } from '@vp/observability';
import { fromPromise, isErr } from '@vp/result';
import { STAGE_REGISTRY } from './registry';
import { type WorkerRunner, createWorkerRunner } from './runner';

export interface WorkerProcess {
  runner: WorkerRunner;
  metricsPort: number;
  shutdown: () => Promise<ShutdownOutcome>;
}

/** A read-only or misconfigured volume costs the liveness probe its file, not the worker its job. */
async function writeHeartbeat(heartbeatPath: string): Promise<void> {
  await fs.mkdir(path.dirname(heartbeatPath), { recursive: true }).catch(() => {});
  await fs.writeFile(heartbeatPath, `${Math.floor(Date.now() / 1000)}\n`).catch(() => {});
}

export async function main(
  env: Record<string, string | undefined> = process.env
): Promise<WorkerProcess> {
  const config = toAppConfig(loadEnv(env));
  const stage = STAGE_REGISTRY[config.worker.stage];

  const runner = await createWorkerRunner({ config });
  console.log(`[worker] Started processing on queue "${runner.worker.name}"`);

  const metricsServer = await startMetricsServer({
    port: config.http.metricsPort,
    registry: getMetrics().registry,
  });
  console.log(`[worker] Metrics server listening on http://0.0.0.0:${metricsServer.port}/metrics`);

  await writeHeartbeat(config.worker.heartbeatPath);
  const heartbeat = setInterval(
    () => void writeHeartbeat(config.worker.heartbeatPath),
    config.worker.heartbeatIntervalMs
  );
  heartbeat.unref?.();

  const shutdown = shutdownOnce({
    drain: () => clearInterval(heartbeat),
    drainDelayMs: 0,
    close: async () => {
      const closed = await fromPromise(
        () => runner.close(),
        (cause) => cause
      );
      await metricsServer.close();
      if (isErr(closed)) throw closed.error;
    },
    graceMs: stage.shutdownTimeoutMs,
    pending: () => runner.disposing(),
    log: (message) => console.log(`[worker] ${message}`),
  });

  return { runner, metricsPort: metricsServer.port, shutdown };
}

if (process.env['NODE_ENV'] !== 'test') {
  main()
    .then(({ shutdown }) => {
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, () => {
          void shutdown().then((outcome) => process.exit(outcome === 'drained' ? 0 : 1));
        });
      }
    })
    .catch((err) => {
      console.error('Fatal worker error:', err);
      process.exit(1);
    });
}
