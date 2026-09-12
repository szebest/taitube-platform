import { runMigrations } from '@vp/db/migrate';
import { seedDatabase } from '@vp/db/seed';

async function main(): Promise<void> {
  await runMigrations();
  await seedDatabase();
  console.log('[api:migrate] Database migration and seed finished.');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[api:migrate] Database migration failed:', err);
    process.exit(1);
  });
