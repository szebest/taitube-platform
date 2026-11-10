import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { eq, sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';
import type { PostgresDatabase } from '../../postgres/repositories/types';
import { migratedPglite } from './pglite-snapshot';
import { claimRealServices } from './real-services';
import type { RepositoriesSubject } from './subjects';

const EMPTY_EVERY_TABLE = sql.raw(`
  DO $$
  DECLARE name text;
  BEGIN
    SET LOCAL session_replication_role = replica;
    FOR name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__vp_migration_hash' LOOP
      EXECUTE format('DELETE FROM %I', name);
    END LOOP;
    FOR name IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
      EXECUTE format('SELECT setval(%L, 1, false)', name);
    END LOOP;
  END $$`);

function subjectOver(db: PostgresDatabase, close: () => Promise<void>): RepositoriesSubject {
  const repositories = new PostgresRepositories({ type: 'drizzle', db });
  return {
    repositories,
    seedVideo: async (input, createdAt) => {
      const created = expectOk(await repositories.videos.create(input));
      if (!createdAt) return created;
      await db.update(schema.videos).set({ createdAt }).where(eq(schema.videos.id, created.id));
      const moved = expectOk(await repositories.videos.findById(created.id));
      if (!moved) throw new Error(`video ${created.id} vanished while its createdAt was moved`);
      return moved;
    },
    adjustComment: async (id, patch) => {
      await db.update(schema.videoComments).set(patch).where(eq(schema.videoComments.id, id));
    },
    backdatePlaylist: async (id, updatedAt) => {
      await db.update(schema.playlists).set({ updatedAt }).where(eq(schema.playlists.id, id));
    },
    ageNotifications: async (ms) => {
      await db.execute(
        sql`update notifications set created_at = created_at - make_interval(secs => ${ms / 1000})`
      );
    },
    reset: async () => {
      await db.execute(EMPTY_EVERY_TABLE);
    },
    close,
  };
}

async function pgliteSubject(): Promise<RepositoriesSubject> {
  const engine = await migratedPglite();
  return subjectOver(drizzlePglite(engine, { schema }), () => engine.close());
}

/** Connects before the first test, so a database that is not there fails the file loudly. */
async function realPostgresSubject(url: string): Promise<RepositoriesSubject> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema });
  await db.execute(sql`select 1`);
  return subjectOver(db, () => client.end());
}

/** PGlite in `unit` and under `bun test`; the Postgres the integration run points at otherwise. */
export async function postgresSubject(): Promise<RepositoriesSubject> {
  const services = claimRealServices();
  return services ? realPostgresSubject(services.databaseUrl) : pgliteSubject();
}
