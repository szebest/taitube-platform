import { loadEnvOrExit } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { type AppConfig, toAppConfig } from '@vp/env-schema';
import { type Logger, createLogger } from '@vp/logger';
import { fromPromise, isOk } from '@vp/result';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

async function migrate({ postgres }: AppConfig, log: Logger): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const migrated = await fromPromise(
      () => runMigrations(postgres.migrationsUrl, log),
      (cause) => cause
    );
    if (isOk(migrated)) {
      log.info({ attempt }, 'database migrated');
      return;
    }
    if (attempt === MAX_ATTEMPTS) throw migrated.error;
    log.warn(
      { err: migrated.error, attempt, attempts: MAX_ATTEMPTS, retryInMs: RETRY_DELAY_MS },
      'migration failed, retrying'
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

const env = loadEnvOrExit('vp-migrate', process);
if (env) {
  const config = toAppConfig(env);
  const log = createLogger({ service: 'vp-migrate', level: config.logLevel, format: 'json' });
  migrate(config, log)
    .then(() => process.exit(0))
    .catch((err) => {
      log.fatal({ err }, 'database migration failed');
      process.exit(1);
    });
}
