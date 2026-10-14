import { loadEnvOrExit } from '@vp/config';
import { seedDatabase } from '@vp/db/seed';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { seedDevelopment } from './seed-development';

const env = loadEnvOrExit('vp-seed', process);
if (env) {
  const config = toAppConfig(env);
  const log = createLogger({ service: 'vp-seed', level: config.logLevel, format: 'json' });
  seedDevelopment(config, (url) => seedDatabase(url, log))
    .then(() => process.exit(0))
    .catch((err) => {
      log.fatal({ err }, 'database seed failed');
      process.exit(1);
    });
}
