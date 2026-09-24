import type * as schema from '@vp/db';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

export type VideoInsert = typeof schema.videos.$inferInsert;

/** Any Drizzle Postgres driver: postgres-js in production, PGlite where a spec needs an engine. */
export type PostgresDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
