import { createLogger } from '@vp/logger';
import { run } from './cli';

const log = createLogger({ service: 'dev-token', level: 'info', format: 'pretty' });

run({
  argv: process.argv.slice(2),
  print: (text) => process.stdout.write(`${text}\n`),
  log,
}).catch((err: unknown) => {
  log.fatal({ err }, 'dev-token failed');
  process.exit(1);
});
