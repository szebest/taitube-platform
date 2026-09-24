import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { isErr } from '@vp/result';
import postgres from 'postgres';
import { type Log, waitForDatabase } from './client';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../drizzle');

/** One digest of every SQL file and the journal: equal digests mean nothing is left to apply. */
export function migrationsHash(folder: string): string {
  const hash = createHash('sha256');
  const sqlFiles = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of sqlFiles) {
    hash.update(fs.readFileSync(path.join(folder, file)));
  }
  const journal = path.join(folder, 'meta', '_journal.json');
  if (fs.existsSync(journal)) {
    hash.update(fs.readFileSync(journal));
  }
  return hash.digest('hex');
}

export async function runMigrations(url: string, log: Log): Promise<void> {
  const sql = postgres(url, { max: 1 });

  const reached = await waitForDatabase(() => sql`SELECT 1`, { label: 'db:migrate', log });
  if (isErr(reached)) throw reached.error;

  log.info({ migrationsFolder: MIGRATIONS_FOLDER }, 'applying migrations');
  const currentHash = migrationsHash(MIGRATIONS_FOLDER);

  await sql`CREATE TABLE IF NOT EXISTS __vp_migration_hash (hash text PRIMARY KEY)`;
  const rows = await sql`SELECT hash FROM __vp_migration_hash LIMIT 1`;
  if (rows[0]?.hash === currentHash) {
    log.info({}, 'migrations unchanged, nothing to apply');
    await sql.end();
    return;
  }

  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  log.info({}, 'migrations applied');

  await sql`DELETE FROM __vp_migration_hash`;
  await sql`INSERT INTO __vp_migration_hash (hash) VALUES (${currentHash})`;

  await sql.end();
}
