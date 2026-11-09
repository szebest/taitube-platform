import type * as schema from '@vp/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { connectPostgres } from '../postgres-connection';

const URL = 'postgres://vp:vp@127.0.0.1:9/vp';

describe('connectPostgres', () => {
  it('borrows a drizzle handle and owns no pool', () => {
    const db = {} as PostgresJsDatabase<typeof schema>;

    expect(connectPostgres({ type: 'drizzle', db })).toEqual({ db, ownedPool: undefined });
  });

  it('wraps a borrowed sql pool without owning it', async () => {
    const pool = postgres(URL, { max: 1 });

    expect(connectPostgres({ type: 'sql', sql: pool }).ownedPool).toBeUndefined();
    await pool.end();
  });

  it('opens a pool from a url and owns it', async () => {
    const { ownedPool } = connectPostgres({ type: 'url', url: URL, max: 2 });

    expect(ownedPool).toBeDefined();
    await ownedPool?.end();
  });
});
