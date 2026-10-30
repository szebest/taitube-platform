import { ErrorCodes } from '@vp/errors';
import { type LibraryApp, buildLibraryApp, OWNER } from '../../__tests__/library-app';

const entryId = (n: number) => `00000000-0000-7000-8000-00000000e1${String(n).padStart(2, '0')}`;
const STRANGER = '22222222-2222-7222-8222-222222222222';
const BASE = Date.parse('2026-03-01T12:00:00.000Z');

describe('search history routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const seed = async (n: number, userId = OWNER) => {
    await ctx.repositories.searchHistory.record({
      id: entryId(n),
      userId,
      query: `Query ${n}`,
      queryKey: `query ${n}`,
      searchedAt: new Date(BASE + n * 60_000),
    });
  };

  const trail = async (who: 'owner' | 'stranger' = 'owner', query = '') =>
    (await ctx.call(who, 'GET', `/v1/me/searches${query}`)).json();

  it.each([
    { method: 'GET' as const, url: '/v1/me/searches' },
    { method: 'DELETE' as const, url: '/v1/me/searches' },
    { method: 'DELETE' as const, url: `/v1/me/searches/${entryId(1)}` },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    expect((await ctx.call('anonymous', method, url)).statusCode).toBe(401);
  });

  it('records a signed-in search and lists it, newest first, a page at a time', async () => {
    for (const n of [1, 2, 3]) await seed(n);

    const first = await trail('owner', '?limit=2');
    const rest = await trail('owner', `?limit=2&cursor=${first.nextCursor}`);

    expect(first.items.map((item: { query: string }) => item.query)).toEqual([
      'Query 3',
      'Query 2',
    ]);
    expect(first.items[0]).toEqual({
      id: entryId(3),
      query: 'Query 3',
      searchedAt: new Date(BASE + 180_000).toISOString(),
    });
    expect(rest.items.map((item: { id: string }) => item.id)).toEqual([entryId(1)]);
    expect(rest.nextCursor).toBeNull();
  });

  it('writes a row when a signed-in caller searches, and none for a guest', async () => {
    await ctx.call('anonymous', 'GET', '/v1/search?q=clip');
    expect((await trail()).items).toEqual([]);

    expect((await ctx.call('owner', 'GET', '/v1/search?q=Clip')).statusCode).toBe(200);

    expect((await trail()).items).toMatchObject([{ query: 'Clip' }]);
  });

  it('writes no row for a preview search', async () => {
    expect((await ctx.call('owner', 'GET', '/v1/search?q=Clip&record=false')).statusCode).toBe(200);

    expect((await trail()).items).toEqual([]);
  });

  it('removes one entry, and answers 404 for an id that is not the caller own', async () => {
    await seed(1);
    await seed(2, STRANGER);

    const theirs = await ctx.call('owner', 'DELETE', `/v1/me/searches/${entryId(2)}`);
    const mine = await ctx.call('owner', 'DELETE', `/v1/me/searches/${entryId(1)}`);

    expect(theirs.statusCode).toBe(404);
    expect(theirs.json().code).toBe(ErrorCodes.SEARCH_HISTORY_NOT_FOUND);
    expect(mine.statusCode).toBe(204);
    expect((await trail()).items).toEqual([]);
    expect((await trail('stranger')).items).toHaveLength(1);
  });

  it('clears only the caller entries', async () => {
    await seed(1);
    await seed(2, STRANGER);

    expect((await ctx.call('owner', 'DELETE', '/v1/me/searches')).statusCode).toBe(204);

    expect((await trail()).items).toEqual([]);
    expect((await trail('stranger')).items).toHaveLength(1);
  });

  it.each([
    { name: 'a cursor that is not one', query: '?cursor=nope', code: ErrorCodes.INVALID_CURSOR },
    { name: 'a zero limit', query: '?limit=0', code: ErrorCodes.VALIDATION_FAILED },
  ])('refuses $name with 400', async ({ query, code }) => {
    const res = await ctx.call('owner', 'GET', `/v1/me/searches${query}`);

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(code);
  });

  it('refuses an id that is not a UUID with 400', async () => {
    expect((await ctx.call('owner', 'DELETE', '/v1/me/searches/nope')).statusCode).toBe(400);
  });
});
