import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type SqlClient = postgres.Sql;

let globalDb: Database | undefined;
let globalSql: SqlClient | undefined;

export function createDbClient(
  url?: string,
  options: { max?: number } = {}
): { db: Database; sql: SqlClient } {
  if (process.env.NODE_ENV === 'test' && globalDb && globalSql && !options.max) {
    return { db: globalDb, sql: globalSql };
  }

  const connectionString = url || process.env.DATABASE_URL || 'postgres://vp:vp@localhost:5432/vp';
  const poolMax =
    options.max ?? (process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : 10);

  const sql = postgres(connectionString, {
    max: poolMax,
  });

  const db = drizzle(sql, { schema });
  if (process.env.NODE_ENV === 'test' && !options.max) {
    globalDb = db;
    globalSql = sql;
  }
  return { db, sql };
}
