import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { isErr } from '@vp/result';
import postgres from 'postgres';
import { type Log, waitForDatabase } from './client';
import { migrationsHash } from './migrations-hash';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../drizzle');

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
