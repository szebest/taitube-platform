import { loadEnv } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { toAppConfig } from '@vp/env-schema';
import { fromPromise, isOk } from '@vp/result';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

async function main(): Promise<void> {
  const { postgres } = toAppConfig(loadEnv());
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const migrated = await fromPromise(
      () => runMigrations(postgres.migrationsUrl, console.log),
      (cause) => cause
    );
    if (isOk(migrated)) {
      console.log('[api:migrate] Database migration finished.');
      return;
    }
    if (attempt === MAX_ATTEMPTS) throw migrated.error;
    const reason =
      migrated.error instanceof Error ? migrated.error.message : String(migrated.error);
    console.warn(
      `[api:migrate] Migration attempt ${attempt}/${MAX_ATTEMPTS} failed: ${reason}. Retrying in ${RETRY_DELAY_MS / 1000}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[api:migrate] Database migration failed:', err);
    process.exit(1);
  });
