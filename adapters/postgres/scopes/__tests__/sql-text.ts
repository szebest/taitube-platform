import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

export function sqlText(condition: SQL | undefined): string | undefined {
  return condition === undefined ? undefined : dialect.sqlToQuery(condition).sql;
}

export function sqlParams(condition: SQL | undefined): unknown[] {
  return condition === undefined ? [] : dialect.sqlToQuery(condition).params;
}
