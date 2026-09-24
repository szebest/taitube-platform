import { loadEnvOrExit } from '@vp/config';
import { seedDatabase } from '@vp/db/seed';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { seedDevelopment } from './seed-development';

const config = toAppConfig(
  loadEnvOrExit('vp-seed', { env: process.env, exit: (code) => process.exit(code) })
);
const log = createLogger({ service: 'vp-seed', level: config.logLevel, format: 'json' });

seedDevelopment(config, (url) => seedDatabase(url, log))
  .then(() => process.exit(0))
  .catch((err) => {
    log.fatal({ err }, 'database seed failed');
    process.exit(1);
  });
