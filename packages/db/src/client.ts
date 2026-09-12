import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type SqlClient = postgres.Sql;

export function createDbClient(
  url?: string,
  options: { max?: number } = {}
): { db: Database; sql: SqlClient } {
  const connectionString = url || process.env.DATABASE_URL || 'postgres://vp:vp@localhost:5432/vp';
  const poolMax =
    options.max ?? (process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : 10);

  const sql = postgres(connectionString, {
    max: poolMax,
  });

  const db = drizzle(sql, { schema });
  return { db, sql };
}
