import { createWorkerRunner } from './runner.js';

export async function main(): Promise<() => Promise<void>> {
  const runner = createWorkerRunner();
  console.log(`[worker] Started processing on queue "${runner.worker.name}"`);

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
