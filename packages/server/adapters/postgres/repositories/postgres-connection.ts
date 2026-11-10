import * as schema from '@vp/db';
import { assertNever } from '@vp/result';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { PostgresDatabase } from './types';

/** A `drizzle` handle or a `sql` pool is borrowed; a `url` opens a pool the bundle ends. */
export type PostgresRepositoriesConfig =
  | { type: 'drizzle'; db: PostgresDatabase }
  | { type: 'sql'; sql: Sql }
  | { type: 'url'; url: string; max: number };

export function connectPostgres(config: PostgresRepositoriesConfig): {
  db: PostgresDatabase;
  ownedPool: Sql | undefined;
} {
  switch (config.type) {
    case 'drizzle':
      return { db: config.db, ownedPool: undefined };
    case 'sql':
      return { db: drizzle(config.sql, { schema }), ownedPool: undefined };
    case 'url': {
      const sql = postgres(config.url, { max: config.max });
      return { db: drizzle(sql, { schema }), ownedPool: sql };
    }
    default:
      return assertNever(config, 'PostgresRepositoriesConfig');
  }
}
