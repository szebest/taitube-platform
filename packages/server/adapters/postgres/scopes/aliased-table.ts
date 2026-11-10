import { type SQL, type Table, sql } from 'drizzle-orm';
import { alias, type PgTable } from 'drizzle-orm/pg-core';

/**
 * An aliased table for a raw subquery. Drizzle prints an alias as its bare name wherever the table
 * is interpolated, so the `FROM` clause is spelled out here while the columns come from `table`.
 */
export function aliasedTable<T extends PgTable>(
  base: T,
  name: string
): { table: ReturnType<typeof alias<T, string>>; from: SQL } {
  return { table: alias(base, name), from: sql`${base as Table} as ${sql.identifier(name)}` };
}
