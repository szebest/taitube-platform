import { loadEnv } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { toAppConfig } from '@vp/env-schema';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2_000;

async function main(): Promise<void> {
  const { postgres } = toAppConfig(loadEnv());
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await runMigrations(postgres.migrationsUrl);
      console.log('[api:migrate] Database migration finished.');
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      console.warn(
        `[api:migrate] Migration attempt ${attempt}/${MAX_ATTEMPTS} failed: ${(err as Error).message}. Retrying in ${RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[api:migrate] Database migration failed:', err);
    process.exit(1);
  });
