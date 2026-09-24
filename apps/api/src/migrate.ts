import { loadEnvOrExit } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { fromPromise, isOk } from '@vp/result';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

const { postgres, logLevel } = toAppConfig(
  loadEnvOrExit('vp-migrate', { env: process.env, exit: (code) => process.exit(code) })
);
const log = createLogger({ service: 'vp-migrate', level: logLevel, format: 'json' });

async function main(): Promise<void> {
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

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log.fatal({ err }, 'database migration failed');
    process.exit(1);
  });
