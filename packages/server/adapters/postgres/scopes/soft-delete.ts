import { type SQL, ne, sql } from 'drizzle-orm';
import type { SoftDeletable } from './traits';
import { drizzleWhere } from './where';

/**
 * Soft-delete scope enforcing that records are not deleted.
 * Checks for `deletedAt IS NULL` and/or `status != 'DELETED'` depending on table columns.
 * Strongly typed with generic constraint over SoftDeletable schema trait (zero any).
 */
export function notDeletedScope<TTable extends SoftDeletable>(table: TTable): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  if (table.deletedAt) {
    conditions.push(sql`${table.deletedAt} IS NULL`);
  }

  if (table.status) {
    conditions.push(ne(table.status, 'DELETED'));
  }

  return drizzleWhere(...conditions);
}
