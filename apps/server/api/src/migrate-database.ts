import type { AppConfig } from '@vp/env-schema';
import type { Logger } from '@vp/logger';
import { fromPromise, isOk } from '@vp/result';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

interface MigrateDeps {
  runMigrations: (url: string) => Promise<void>;
  wait: (ms: number) => Promise<void>;
  log: Logger;
}

/** Retries a database that is still starting; the last failure is the one that is thrown. */
export async function migrateDatabase(
  { postgres }: AppConfig,
  { runMigrations, wait, log }: MigrateDeps
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const migrated = await fromPromise(
      () => runMigrations(postgres.migrationsUrl),
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
    await wait(RETRY_DELAY_MS);
  }
}
