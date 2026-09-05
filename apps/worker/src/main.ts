import { createWorkerRunner } from './runner.js';

export async function main(): Promise<() => Promise<void>> {
  const metricsPortEnv = process.env['METRICS_PORT'];
  const metricsPort =
    metricsPortEnv && metricsPortEnv.trim() !== '' ? Number.parseInt(metricsPortEnv, 10) : 9464;

  const runner = await createWorkerRunner({
    metricsPort,
  });
  console.log(`[worker] Started processing on queue "${runner.worker.name}"`);
  if (runner.metricsServer) {
    console.log(`[worker] Metrics server listening on http://0.0.0.0:${runner.metricsServer.port}/metrics`);
  }

  const shutdown = async () => {
    console.log('[worker] Received shutdown signal, closing worker gracefully...');
    await runner.close();
    console.log('[worker] Shutdown complete.');
  };

  process.on('SIGTERM', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });

  process.on('SIGINT', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });

  return shutdown;
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    console.error('Fatal worker error:', err);
    process.exit(1);
  });
}
