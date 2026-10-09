import { type SQL, sql } from 'drizzle-orm';

/**
 * A tuning constant inlined as a literal rather than bound: Postgres folds it into the plan and
 * types it from the expression around it, where a parameter would arrive untyped.
 */
export function constant(value: number): SQL {
  return sql.raw(String(value));
}
