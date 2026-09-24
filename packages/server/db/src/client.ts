import { type Result, err, fromPromise, isOk, ok } from '@vp/result';
import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type SqlClient = postgres.Sql;

export function createDbClient(
  url: string,
  options: { max?: number } = {}
): { db: Database; sql: SqlClient } {
  const sql = postgres(url, { max: options.max ?? 10 });
  return { db: drizzle(sql, { schema }), sql };
}

/** Where a library function reports progress: the entrypoint hands it its `@vp/logger` logger. */
export interface Log {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface WaitOptions {
  label: string;
  log: Log;
  attempts?: number;
  delayMs?: number;
}

export async function waitForDatabase(
  probe: () => PromiseLike<unknown>,
  { label, log, attempts = 15, delayMs = 1_000 }: WaitOptions
): Promise<Result<void, Error>> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const reached = await fromPromise(probe, (cause) => cause);
    if (isOk(reached)) return ok();
    log.warn(
      { label, attempt, attempts, retryInMs: delayMs, err: reached.error },
      'database not reachable yet'
    );
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return err(new Error(`[${label}] Failed to connect to database after ${attempts} attempts`));
}
