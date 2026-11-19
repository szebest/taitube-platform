import { setTimeout as wait } from 'node:timers/promises';
import { loadEnvOrExit } from '@kit/config';
import { createLogger } from '@kit/logger';
import { runMigrations } from '@vp/db/migrate';
import { AppEnvSchema, DEFAULT_LOG_LEVEL, toAppConfig } from '@vp/env-schema';
import { migrateDatabase } from './migrate-database';

const env = loadEnvOrExit(AppEnvSchema, DEFAULT_LOG_LEVEL, 'vp-migrate', process);
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
