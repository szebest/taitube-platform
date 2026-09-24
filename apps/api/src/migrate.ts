import { loadEnv } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { toAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { fromPromise, isOk } from '@vp/result';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

const log = createLogger({ service: 'vp-migrate', level: 'info', format: 'json' });

async function main(): Promise<void> {
  const { postgres } = toAppConfig(loadEnv());
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
