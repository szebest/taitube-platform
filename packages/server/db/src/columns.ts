import { type SQL, sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** The quoted, comma-separated labels of a closed vocabulary, for a CHECK ... IN (...). */
export const listOf = (values: readonly string[]): SQL =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));
