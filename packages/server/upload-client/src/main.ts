#!/usr/bin/env node
import { createLogger } from '@vp/logger';
import { run } from './cli';

const log = createLogger({ service: 'upload-client', level: 'info', format: 'pretty' });

run({
  argv: process.argv.slice(2),
  env: process.env,
  print: (text) => process.stdout.write(`${text}\n`),
  log,
}).catch((err: unknown) => {
  log.fatal({ err }, 'upload failed');
  process.exit(1);
});
