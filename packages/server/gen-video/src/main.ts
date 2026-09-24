import { run } from './cli';

run({ argv: process.argv.slice(2) }).catch((err: unknown) => {
  console.error('[gen-video]', err instanceof Error ? err.message : err);
  process.exit(1);
});
