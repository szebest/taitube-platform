import { setTimeout as wait } from 'node:timers/promises';
import { loadEnvOrExit } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { migrateDatabase } from './migrate-database';

const env = loadEnvOrExit('vp-migrate', process);
if (env) {
  const config = toAppConfig(env);
  const log = createLogger({ service: 'vp-migrate', level: config.logLevel, format: 'json' });
  migrateDatabase(config, { runMigrations: (url) => runMigrations(url, log), wait, log })
    .then(() => process.exit(0))
    .catch((err) => {
      log.fatal({ err }, 'database migration failed');
      process.exit(1);
    });
}
