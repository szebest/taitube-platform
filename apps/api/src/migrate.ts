export async function runMigrations(): Promise<void> {
  console.log('[migrate] Running database migrations...');
}

if (process.env['NODE_ENV'] !== 'test') {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
