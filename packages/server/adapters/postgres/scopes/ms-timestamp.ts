import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * A timestamp column cut to the milliseconds a keyset cursor carries. `now()` stamps microseconds
 * and a cursor round-trips through a JS `Date`, so a walk ordered and compared on the raw column
 * skips the rows that share the cursor row's millisecond. The `ORDER BY` and the keyset sort key
 * both take it, or the order and the cursor disagree (`keyset-timestamps.test.ts`).
 */
export function msTimestamp(column: AnyPgColumn): SQL<Date> {
  return sql<Date>`date_trunc('milliseconds', ${column})`;
}
