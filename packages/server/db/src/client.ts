import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type SqlClient = postgres.Sql;

export function createDbClient(
  url: string,
  options: { max?: number } = {}
): { db: Database; sql: SqlClient } {
  const sql = postgres(url, { max: options.max ?? 10 });
  return { db: drizzle(sql, { schema }), sql };
}
