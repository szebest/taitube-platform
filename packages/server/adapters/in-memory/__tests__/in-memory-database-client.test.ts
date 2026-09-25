import { ErrorCodes } from '@vp/errors';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { InMemoryDatabaseClient } from '../in-memory-database-client';

describe('InMemoryDatabaseClient', () => {
  it('answers every query with no rows and every statement with no affected rows', async () => {
    const client = new InMemoryDatabaseClient();

    expect(expectOk(await client.query('SELECT 1'))).toEqual([]);
    expect(expectOk(await client.execute('DELETE FROM videos'))).toBe(0);
  });

  it('runs a transaction over itself and hands back what it returned', async () => {
    const client = new InMemoryDatabaseClient();

    const result = await client.transaction(async (tx) => ok(tx === client));

    expect(expectOk(result)).toBe(true);
  });

  it('reports DATABASE_UNAVAILABLE from its health check once marked unhealthy', async () => {
    const client = new InMemoryDatabaseClient();

    client.setHealthy(false);

    expect(expectErr(await client.checkHealth()).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
  });
});
