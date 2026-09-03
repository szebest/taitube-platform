import { runMigrations } from '@vp/db';

runMigrations()
  .then(() => {
    console.log('[api:migrate] Database migration finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[api:migrate] Database migration failed:', err);
    process.exit(1);
  });
