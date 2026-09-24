import * as path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { eq, sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';
import type { PostgresDatabase } from '../../postgres/repositories/types';
import { claimRealServices } from './real-services';
import type { RepositoriesSubject } from './subjects';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../../db/drizzle');

const TRUNCATE = sql.raw(
  `TRUNCATE ${[
    'channel_subscriptions',
    'video_reactions',
    'outbox',
    'dlq_entries',
    'video_events',
    'renditions',
    'processing_steps',
    'uploads',
    'videos',
    'categories',
    'channels',
    'users',
  ].join(', ')} RESTART IDENTITY CASCADE`
);

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
    reset: async () => {
      await db.execute(TRUNCATE);
    },
    close,
  };
}

async function migratedPglite(): Promise<PostgresDatabase> {
  const db = drizzlePglite(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

let pglite: Promise<PostgresDatabase> | undefined;

/**
 * One engine per module graph: starting PGlite costs most of a second, so the specs that share a
 * worker (`vitest.pglite.config.ts` runs them unisolated) share it too, and each truncates it.
 */
async function pgliteSubject(): Promise<RepositoriesSubject> {
  pglite ??= migratedPglite();
  return subjectOver(await pglite, async () => {});
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
