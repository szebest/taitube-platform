import { createWorkerRunner } from './runner';

export async function main(): Promise<() => Promise<void>> {
  const metricsPortEnv = process.env['METRICS_PORT'];
  const metricsPort =
    metricsPortEnv && metricsPortEnv.trim() !== '' ? Number.parseInt(metricsPortEnv, 10) : 9464;

  const runner = await createWorkerRunner({
    metricsPort,
  });
  console.log(`[worker] Started processing on queue "${runner.worker.name}"`);
  if (runner.metricsServer) {
    console.log(
      `[worker] Metrics server listening on http://0.0.0.0:${runner.metricsServer.port}/metrics`
    );
  }

  const heartbeatPath = process.env['WORKER_HEARTBEAT_PATH'] || '/tmp/vp/heartbeat';
  const writeHeartbeat = async () => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      await fs.mkdir(path.dirname(heartbeatPath), { recursive: true });
      await fs.writeFile(heartbeatPath, `${Math.floor(Date.now() / 1000)}\n`);
    } catch {
      // Ignore heartbeat write errors (e.g. read-only if misconfigured)
    }
  };
  await writeHeartbeat();
  const heartbeatTimer = setInterval(writeHeartbeat, 15000);
  heartbeatTimer.unref?.();

  const shutdown = async () => {
    clearInterval(heartbeatTimer);
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
