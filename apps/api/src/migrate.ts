import { loadEnv } from '@vp/config';
import { runMigrations } from '@vp/db/migrate';
import { seedDatabase } from '@vp/db/seed';
import { toAppConfig } from '@vp/env-schema';

async function main(): Promise<void> {
  const { postgres } = toAppConfig(loadEnv());
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await runMigrations(postgres.migrationsUrl);
      await seedDatabase(postgres.url);
      console.log('[api:migrate] Database migration and seed finished.');
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      console.warn(
        `[api:migrate] Migration/seed attempt ${attempt}/${maxRetries} failed: ${(err as Error).message}. Retrying in 2s...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[api:migrate] Database migration failed:', err);
    process.exit(1);
  });
