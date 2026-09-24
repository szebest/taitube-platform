import { loadEnv } from '@vp/config';
import { seedDatabase } from '@vp/db/seed';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { seedDevelopment } from './seed-development';

const log = createLogger({ service: 'vp-seed', level: 'info', format: 'json' });

seedDevelopment(toAppConfig(loadEnv()), (url) => seedDatabase(url, log))
  .then(() => process.exit(0))
  .catch((err) => {
    log.fatal({ err }, 'database seed failed');
    process.exit(1);
  });
