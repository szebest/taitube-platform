import { type SQL, and } from 'drizzle-orm';

export type WhereCondition = SQL | undefined | null | false;

/**
 * Composable condition combiner for Drizzle SQL queries.
 * Safely cleanses undefined, null, and false conditions,
 * and composes the remaining active SQL conditions using and(...).
 * Returns undefined if no active conditions exist (preventing empty and() clauses).
 */
export function drizzleWhere(...conditions: WhereCondition[]): SQL | undefined {
  const active = conditions.filter((c): c is SQL => Boolean(c));
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }
  return and(...active);
}
