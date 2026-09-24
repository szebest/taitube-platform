import { expectErr, expectOk } from '@vp/testing/result';
import { createDbClient, waitForDatabase } from '../client';

describe('packages/db: createDbClient', () => {
  it.each([
    { scenario: 'the default pool', options: {}, max: 10 },
    { scenario: 'a sized pool', options: { max: 3 }, max: 3 },
  ])('opens $scenario on the url it is given, without connecting', async ({ options, max }) => {
    const { db, sql } = createDbClient('postgres://vp:vp@127.0.0.1:9/vp', options);

    expect(sql.options.max).toBe(max);
    expect(sql.options.host).toEqual(['127.0.0.1']);
    expect(db).toBeDefined();
    await sql.end();
  });
});

describe('packages/db: waitForDatabase', () => {
  it('succeeds on the first probe the database answers, reporting the failed attempt', async () => {
    const log = { info: vi.fn(), warn: vi.fn() };
    const probe = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue([]);

    expectOk(await waitForDatabase(probe, { label: 'db:test', log, delayMs: 0 }));
    expect(probe).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0]?.[0]).toMatchObject({
      label: 'db:test',
      attempt: 1,
      attempts: 15,
    });
  });

  it('gives up after the last attempt, naming the label', async () => {
    const probe = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('ECONNREFUSED'));

    const reached = await waitForDatabase(probe, {
      label: 'db:test',
      log: { info: () => {}, warn: () => {} },
      attempts: 3,
      delayMs: 0,
    });

    expect(expectErr(reached).message).toBe(
      '[db:test] Failed to connect to database after 3 attempts'
    );
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
