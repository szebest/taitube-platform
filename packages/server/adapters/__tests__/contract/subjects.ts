import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { NewVideoInput, Repositories, VideoRecord } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { type SQL, eq, sql } from 'drizzle-orm';
import { type PgliteDatabase, drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { InMemoryRepositories } from '../../in-memory/repositories/in-memory-repositories';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';

export interface RepositoriesSubject {
  readonly repositories: Repositories;
  /** `create` stamps its own `createdAt`; feed ordering needs rows placed in the past. */
  seedVideo(input: NewVideoInput, createdAt?: Date): Promise<VideoRecord>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export type MakeRepositoriesSubject = () => Promise<RepositoriesSubject>;

export async function inMemorySubject(): Promise<RepositoriesSubject> {
  const repositories = new InMemoryRepositories();
  return {
    repositories,
    seedVideo: async (input, createdAt) => {
      const record = expectOk(await repositories.videos.create(input));
      if (createdAt) record.createdAt = createdAt;
      return record;
    },
    reset: async () => {
      repositories.clear();
    },
    close: async () => {},
  };
}

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../db/drizzle'
);

const TRUNCATABLE_TABLES = [
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
];

/**
 * postgres-js resolves `execute` to a row array; the PGLite driver resolves it to a
 * `{ rows }` envelope. Repositories are written against the production driver, so the
 * stand-in is adapted rather than the code under test.
 */
function withPostgresJsExecuteShape(db: PgliteDatabase<typeof schema>): void {
  const execute = db.execute.bind(db);
  Object.assign(db, {
    execute: (query: SQL) =>
      execute(query).then((result: unknown) =>
        Array.isArray(result) ? result : ((result as { rows: unknown[] }).rows ?? [])
      ),
  });
}

export async function pgliteSubject(): Promise<RepositoriesSubject> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  withPostgresJsExecuteShape(db);

  const truncate = sql.raw(
    `TRUNCATE ${TRUNCATABLE_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
  );

  const repositories = new PostgresRepositories({
    type: 'drizzle',
    db: db as unknown as PostgresJsDatabase<typeof schema>,
  });

  return {
    repositories,
    seedVideo: async (input, createdAt) => {
      const created = expectOk(await repositories.videos.create(input));
      if (!createdAt) return created;
      const [updated] = await db
        .update(schema.videos)
        .set({ createdAt })
        .where(eq(schema.videos.id, created.id))
        .returning();
      return updated as VideoRecord;
    },
    reset: async () => {
      await db.execute(truncate);
    },
    close: async () => {
      await client.close();
    },
  };
}

export const REPOSITORY_ADAPTERS: ReadonlyArray<{
  name: string;
  makeSubject: MakeRepositoriesSubject;
}> = [
  { name: 'InMemoryRepositories', makeSubject: inMemorySubject },
  { name: 'PostgresRepositories (PGLite)', makeSubject: pgliteSubject },
];
