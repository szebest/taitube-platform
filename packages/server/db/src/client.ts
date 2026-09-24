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

export interface WaitOptions {
  label: string;
  attempts?: number;
  delayMs?: number;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export async function waitForDatabase(
  probe: () => PromiseLike<unknown>,
  { label, attempts = 15, delayMs = 1_000 }: WaitOptions
): Promise<Result<void, Error>> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const reached = await fromPromise(probe, messageOf);
    if (isOk(reached)) return ok();
    console.warn(
      `[${label}] Database connection attempt ${attempt}/${attempts} failed (${reached.error}), retrying in ${delayMs / 1000}s...`
    );
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return err(new Error(`[${label}] Failed to connect to database after ${attempts} attempts`));
}
