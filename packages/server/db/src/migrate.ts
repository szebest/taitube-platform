import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { isErr } from '@vp/result';
import postgres from 'postgres';
import { type Log, waitForDatabase } from './client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(url: string, log: Log): Promise<void> {
  log(`[db:migrate] Connecting to ${url.replace(/:[^:@]+@/, ':***@')}...`);
  const sql = postgres(url, { max: 1 });

  const reached = await waitForDatabase(() => sql`SELECT 1`, { label: 'db:migrate', log });
  if (isErr(reached)) throw reached.error;

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
  log(`[db:migrate] Applying migrations from ${migrationsFolder}...`);

  const hash = createHash('sha256');
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
    log('[db:migrate] Migrations unchanged (hash match). Skipping execution.');
    await sql.end();
    return;
  }

  await migrate(db, { migrationsFolder });
  log('[db:migrate] Migrations applied successfully.');

  await sql`DELETE FROM __vp_migration_hash`;
  await sql`INSERT INTO __vp_migration_hash (hash) VALUES (${currentHash})`;

  await sql.end();
}
