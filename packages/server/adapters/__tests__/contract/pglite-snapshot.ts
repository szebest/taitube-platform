import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { migrationsHash } from '@vp/db/migrations-hash';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../../db/drizzle');

/**
 * A fresh PGlite runs initdb, most of a second; one loaded from a migrated data directory starts
 * in a tenth of that. The directory is built once per migration set and shared through the OS
 * temp dir, so every spec file still gets an engine of its own.
 */
async function migratedDataDir(): Promise<Blob> {
  const cached = path.join(os.tmpdir(), `vp-pglite-${migrationsHash(MIGRATIONS_FOLDER)}.tar`);
  if (fs.existsSync(cached)) return new Blob([fs.readFileSync(cached)]);

  const engine = new PGlite({ extensions: { pg_trgm } });
  await migrate(drizzle(engine), { migrationsFolder: MIGRATIONS_FOLDER });
  const dataDir = await engine.dumpDataDir('none');
  await engine.close();

  const partial = `${cached}.${randomUUID()}`;
  fs.writeFileSync(partial, Buffer.from(await dataDir.arrayBuffer()));
  fs.renameSync(partial, cached);
  return dataDir;
}

/** An engine of its own over the migrated snapshot, with the extensions the migrations create. */
export async function migratedPglite(): Promise<PGlite> {
  return new PGlite({ loadDataDir: await migratedDataDir(), extensions: { pg_trgm } });
}

/** Builds the snapshot before any spec starts, so parallel workers do not each run initdb. */
export default async function setup(): Promise<void> {
  await migratedDataDir();
}
