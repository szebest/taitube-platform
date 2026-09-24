import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { migrationsHash } from '@vp/db/migrations-hash';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../../db/drizzle');

/**
 * A fresh PGlite runs initdb, most of a second; one loaded from a migrated data directory starts
 * in a tenth of that. The directory is built once per migration set and shared through the OS
 * temp dir, so every spec file still gets an engine of its own.
 */
export async function migratedDataDir(): Promise<Blob> {
  const cached = path.join(os.tmpdir(), `vp-pglite-${migrationsHash(MIGRATIONS_FOLDER)}.tar`);
  if (fs.existsSync(cached)) return new Blob([fs.readFileSync(cached)]);

  const engine = new PGlite();
  await migrate(drizzle(engine), { migrationsFolder: MIGRATIONS_FOLDER });
  const dataDir = await engine.dumpDataDir('none');
  await engine.close();

  const partial = `${cached}.${randomUUID()}`;
  fs.writeFileSync(partial, Buffer.from(await dataDir.arrayBuffer()));
  fs.renameSync(partial, cached);
  return dataDir;
}

/** Builds the snapshot before any spec starts, so parallel workers do not each run initdb. */
export default async function setup(): Promise<void> {
  await migratedDataDir();
}
