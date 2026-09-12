import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(connectionUrl?: string): Promise<void> {
  const url =
    connectionUrl ||
    process.env.DATABASE_URL_MIGRATIONS ||
    process.env.DATABASE_URL ||
    'postgres://vp:vp@localhost:5432/vp';

  console.log(`[db:migrate] Connecting to ${url.replace(/:[^:@]+@/, ':***@')}...`);
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  const candidates = [
    path.resolve(__dirname, '../drizzle'),
    path.resolve(__dirname, '../../packages/db/drizzle'),
    path.resolve(process.cwd(), 'packages/db/drizzle'),
    path.resolve(process.cwd(), 'node_modules/@vp/db/drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
  ];
  const migrationsFolder = candidates.find((dir) => fs.existsSync(dir)) ?? (candidates[0] as string);
  console.log(`[db:migrate] Applying migrations from ${migrationsFolder}...`);

  await migrate(db, { migrationsFolder });
  console.log('[db:migrate] Migrations applied successfully.');

  await sql.end();
}

// Auto-run if executed directly as entrypoint
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db:migrate] Migration failed:', err);
      process.exit(1);
    });
}
