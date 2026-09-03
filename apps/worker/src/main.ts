import { getWorkerStage } from './config.js';
import { STAGE_REGISTRY } from './registry.js';

export async function main(): Promise<void> {
  const stage = getWorkerStage();
  const config = STAGE_REGISTRY[stage];
  if (!config) {
    throw new Error(`Unknown WORKER_STAGE: ${stage}`);
  }
  console.log(`[worker:${stage}] Started with concurrency=${config.concurrency}`);
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch((err) => {
    console.error('Fatal worker error:', err);
    process.exit(1);
  });
}
