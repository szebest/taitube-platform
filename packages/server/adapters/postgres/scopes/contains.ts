import { ilike, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Case-insensitive substring match, with the user's `%`, `_` and `\` matching themselves. */
export function containsScope(column: AnyPgColumn, text: string | undefined): SQL | undefined {
  if (!text) return undefined;
  return ilike(column, `%${text.replace(/[\\%_]/g, '\\$&')}%`);
}
