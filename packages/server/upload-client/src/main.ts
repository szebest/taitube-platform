#!/usr/bin/env node
import { run } from './cli';

run({ argv: process.argv.slice(2), env: process.env }).catch((err: unknown) => {
  console.error('[upload-client]', err instanceof Error ? err.message : err);
  process.exit(1);
});
