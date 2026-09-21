import { type SQL, type SQLWrapper, and, eq, lt, or } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** The last row of a page: its sort key and the tiebreaker that orders rows sharing one. */
export interface KeysetCursor {
  sort: unknown;
  tie: string;
}

/**
 * `(sort, tie) < (cursor.sort, cursor.tie)` in descending keyset order, so a row is
 * never skipped or repeated when two rows share a sort key. The sort key may be a
 * column or a ranking expression, as long as the cursor carries the same value.
 */
export function keysetBefore(
  sortKey: SQLWrapper,
  tieColumn: AnyPgColumn,
  cursor?: KeysetCursor | null
): SQL | undefined {
  if (!cursor) return undefined;
  return or(lt(sortKey, cursor.sort), and(eq(sortKey, cursor.sort), lt(tieColumn, cursor.tie)));
}
