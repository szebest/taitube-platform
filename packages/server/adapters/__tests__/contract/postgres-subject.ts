import { PGlite } from '@electric-sql/pglite';
import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { eq, sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';
import type { PostgresDatabase } from '../../postgres/repositories/types';
import { migratedDataDir } from './pglite-snapshot';
import { claimRealServices } from './real-services';
import type { RepositoriesSubject } from './subjects';

const TRUNCATE = sql.raw(
  `TRUNCATE ${[
    'channel_subscriptions',
    'video_comments',
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
    adjustComment: async (id, patch) => {
      await db.update(schema.videoComments).set(patch).where(eq(schema.videoComments.id, id));
    },
    reset: async () => {
      await db.execute(TRUNCATE);
    },
    close,
  };
}

async function pgliteSubject(): Promise<RepositoriesSubject> {
  const engine = new PGlite({ loadDataDir: await migratedDataDir() });
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
