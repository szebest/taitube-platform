import { clearSearchHistory, listSearchHistory, removeSearchHistoryEntry } from '../search-history';

describe('packages/api-contracts: search history', () => {
  it.each([
    { endpoint: listSearchHistory, method: 'GET', path: '/v1/me/searches', status: 200 },
    {
      endpoint: removeSearchHistoryEntry,
      method: 'DELETE',
      path: '/v1/me/searches/:id',
      status: 204,
    },
    { endpoint: clearSearchHistory, method: 'DELETE', path: '/v1/me/searches', status: 204 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('refuses an id that is not a UUID', () => {
    expect(removeSearchHistoryEntry.params.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('pages with a cursor and a limit', () => {
    expect(listSearchHistory.query.parse({ cursor: 'abc', limit: '5' })).toEqual({
      cursor: 'abc',
      limit: 5,
    });
  });
});
