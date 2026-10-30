import { DatabaseClient } from '@vp/core/ports';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { Sql } from 'postgres';
import { PostgresDatabaseClient } from '../postgres-database-client';

function fakeSql(outcome: 'resolves' | 'rejects' = 'resolves') {
  const answer = <T>(value: T) =>
    outcome === 'resolves'
      ? Promise.resolve(value)
      : Promise.reject(new Error('connection refused'));
  const rows = Object.assign([{ id: 1 }], { count: 3 });
  const sql = Object.assign(() => answer([{ '?column?': 1 }]), {
    unsafe: vi.fn(() => answer(rows)),
    begin: vi.fn((fn: (tx: unknown) => unknown) => answer(null).then(() => fn(sql))),
    savepoint: vi.fn((fn: (tx: unknown) => unknown) => answer(null).then(() => fn(sql))),
    end: vi.fn(() => answer(undefined)),
  });
  return sql as unknown as Sql & {
    end: ReturnType<typeof vi.fn>;
    savepoint: ReturnType<typeof vi.fn>;
  };
}

describe('PostgresDatabaseClient', () => {
  it('answers a health probe, a query and an execute over the pool it is handed', async () => {
    const client = new PostgresDatabaseClient({ type: 'sql', sql: fakeSql() });

    expectOk(await client.checkHealth());
    expect([...expectOk(await client.query('SELECT id FROM videos'))]).toEqual([{ id: 1 }]);
    expect(expectOk(await client.execute('DELETE FROM videos'))).toBe(3);
  });

  it('runs a transaction over a client bound to the transaction', async () => {
    const client = new PostgresDatabaseClient({ type: 'sql', sql: fakeSql() });

    const result = await client.transaction(async (tx) => {
      expect(tx).toBeInstanceOf(DatabaseClient);
      expect(tx).not.toBe(client);
      return ok('committed');
    });

    expect(expectOk(result)).toBe('committed');
  });

  it('nests a transaction inside another as a savepoint', async () => {
    const sql = fakeSql();
    const client = new PostgresDatabaseClient({ type: 'sql', sql });

    const result = await client.transaction((tx) => tx.transaction(async () => ok('inner')));

    expect(expectOk(result)).toBe('inner');
    expect(sql.savepoint).toHaveBeenCalledTimes(1);
  });

  it.each([
    { operation: 'checkHealth', run: (c: PostgresDatabaseClient) => c.checkHealth() },
    { operation: 'query', run: (c: PostgresDatabaseClient) => c.query('SELECT 1') },
    { operation: 'execute', run: (c: PostgresDatabaseClient) => c.execute('SELECT 1') },
  ] as {
    operation: string;
    run: (c: PostgresDatabaseClient) => Promise<Result<unknown, DatabaseUnavailable>>;
  }[])('reports a driver failure on $operation as DATABASE_UNAVAILABLE', async ({ run }) => {
    const client = new PostgresDatabaseClient({ type: 'sql', sql: fakeSql('rejects') });

    expect(expectErr(await run(client)).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
  });

  it('leaves a pool it was handed open on close, for its owner to end', async () => {
    const sql = fakeSql();

    expectOk(await new PostgresDatabaseClient({ type: 'sql', sql }).close());

    expect(sql.end).not.toHaveBeenCalled();
  });

  it('opens its own pool from a url, sized as configured, and ends it on close', async () => {
    const client = new PostgresDatabaseClient({
      type: 'url',
      url: 'postgres://vp:vp@127.0.0.1:9/vp',
      max: 4,
    });
    const end = vi.spyOn(client.getRawSql(), 'end');

    expect(client.getRawSql().options.max).toBe(4);
    expectOk(await client.close());
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('reports a pool that fails to end as DATABASE_UNAVAILABLE', async () => {
    const client = new PostgresDatabaseClient({
      type: 'url',
      url: 'postgres://vp:vp@127.0.0.1:9/vp',
      max: 1,
    });
    vi.spyOn(client.getRawSql(), 'end').mockRejectedValue(new Error('socket hang up'));

    expect(expectErr(await client.close()).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
  });
});
