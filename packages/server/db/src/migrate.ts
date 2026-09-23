import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(url: string): Promise<void> {
  console.log(`[db:migrate] Connecting to ${url.replace(/:[^:@]+@/, ':***@')}...`);
  const sql = postgres(url, { max: 1 });

  let connected = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await sql`SELECT 1`;
      connected = true;
      break;
    } catch (err) {
      console.warn(
        `[db:migrate] Database connection attempt ${attempt}/15 failed (${(err as Error).message}), retrying in 1s...`
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!connected) {
    throw new Error('[db:migrate] Failed to connect to database after 15 attempts');
  }

  const db = drizzle(sql);

  const candidates = [
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(process.cwd(), 'packages/server/db/drizzle'),
    path.resolve(process.cwd(), 'node_modules/@vp/db/drizzle'),
    path.resolve(__dirname, '../drizzle'),
    path.resolve(__dirname, '../../packages/db/drizzle'),
    path.resolve(__dirname, '../../../packages/db/drizzle'),
    path.resolve(__dirname, '../../drizzle'),
  ];
  const migrationsFolder =
    candidates.find((dir) => fs.existsSync(path.join(dir, 'meta', '_journal.json'))) ??
    candidates.find((dir) => fs.existsSync(dir)) ??
    (candidates[0] as string);
  console.log(`[db:migrate] Applying migrations from ${migrationsFolder}...`);

  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256');
  const files = fs.readdirSync(migrationsFolder).sort();
  for (const file of files) {
    if (file.endsWith('.sql')) {
      hash.update(fs.readFileSync(path.join(migrationsFolder, file)));
    }
  }
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  if (fs.existsSync(journalPath)) {
    hash.update(fs.readFileSync(journalPath));
  }
  const currentHash = hash.digest('hex');

  await sql`CREATE TABLE IF NOT EXISTS __vp_migration_hash (hash text PRIMARY KEY)`;
  const rows = await sql`SELECT hash FROM __vp_migration_hash LIMIT 1`;
  if (rows.length > 0 && rows[0]?.hash === currentHash) {
    console.log('[db:migrate] Migrations unchanged (hash match). Skipping execution.');
    await sql.end();
    return;
  }

  await migrate(db, { migrationsFolder });
  console.log('[db:migrate] Migrations applied successfully.');

  await sql`DELETE FROM __vp_migration_hash`;
  await sql`INSERT INTO __vp_migration_hash (hash) VALUES (${currentHash})`;

  await sql.end();
}

// Auto-run if executed directly as entrypoint
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()
) {
  runMigrations(
    process.env['DATABASE_URL_MIGRATIONS'] ??
      process.env['DATABASE_URL'] ??
      'postgres://vp:vp@localhost:5432/vp'
  )
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[db:migrate] Migration failed:', err);
      process.exit(1);
    });
}
