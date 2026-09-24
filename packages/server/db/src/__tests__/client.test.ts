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
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds on the first probe the database answers', async () => {
    const probe = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue([]);

    expectOk(await waitForDatabase(probe, { label: 'db:test', delayMs: 0 }));
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt, naming the label', async () => {
    const probe = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('ECONNREFUSED'));

    const reached = await waitForDatabase(probe, { label: 'db:test', attempts: 3, delayMs: 0 });

    expect(expectErr(reached).message).toBe(
      '[db:test] Failed to connect to database after 3 attempts'
    );
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
