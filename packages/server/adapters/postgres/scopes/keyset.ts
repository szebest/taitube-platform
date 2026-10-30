import { and, eq, gt, lt, or, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** The last row of a page: its sort key and the tiebreaker that orders rows sharing one. */
export interface KeysetCursor {
  sort: unknown;
  tie: string;
}

/**
 * The rows after the cursor in the walk's order: `(sort, tie) < (cursor.sort, cursor.tie)` going
 * down, `>` going up, so a row is never skipped or repeated when two rows share a sort key. The
 * sort key may be a column or a ranking expression, as long as the cursor carries the same value.
 */
export function keysetPast(
  sortKey: SQLWrapper,
  tieColumn: AnyPgColumn,
  cursor: KeysetCursor | null | undefined,
  order: 'asc' | 'desc'
): SQL | undefined {
  if (!cursor) return undefined;
  const beyond = order === 'asc' ? gt : lt;
  return or(
    beyond(sortKey, cursor.sort),
    and(eq(sortKey, cursor.sort), beyond(tieColumn, cursor.tie))
  );
}

export function keysetBefore(
  sortKey: SQLWrapper,
  tieColumn: AnyPgColumn,
  cursor?: KeysetCursor | null
): SQL | undefined {
  return keysetPast(sortKey, tieColumn, cursor, 'desc');
}
