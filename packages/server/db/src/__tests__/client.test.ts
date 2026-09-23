import { createDbClient } from '../client';

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
