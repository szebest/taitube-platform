import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { seedDatabase } from '@vp/db/seed';
import { AppEnvSchema, DEFAULT_LOG_LEVEL, toAppConfig } from '@vp/env-schema';
import { seedDevelopment } from './seed-development';

const env = loadEnvOrExit(AppEnvSchema, DEFAULT_LOG_LEVEL, 'vp-seed', process);
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
