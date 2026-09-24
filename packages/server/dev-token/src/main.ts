import { run } from './cli';

run({ argv: process.argv.slice(2) }).catch((err: unknown) => {
  console.error('dev-token:', err instanceof Error ? err.message : err);
  process.exit(1);
});
