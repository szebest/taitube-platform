import { run } from '../packages/platform/server/dev-token/src/index';
import { createLogger } from '../packages/platform/server/logger/src/index';
import { DEV_TOKEN_CONFIG } from '../packages/server/dev-identity/src/index';

const log = createLogger({ service: 'dev-token', level: 'info', format: 'pretty' });

run(DEV_TOKEN_CONFIG, {
  argv: process.argv.slice(2),
  print: (text) => process.stdout.write(`${text}\n`),
  log,
}).catch((err: unknown) => {
  log.fatal({ err }, 'dev-token failed');
  process.exit(1);
});
