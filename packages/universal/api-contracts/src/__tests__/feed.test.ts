import { getFeed } from '../feed';

describe('packages/api-contracts: feed', () => {
  it('is an anonymous GET /v1/feed', () => {
    expect(getFeed).toMatchObject({
      method: 'GET',
      path: '/v1/feed',
      anonymous: true,
      status: 200,
    });
  });

  it('defaults sort to recent, format to standard and limit to 20', () => {
    expect(getFeed.query.parse({})).toEqual({ sort: 'recent', format: 'standard', limit: 20 });
  });

  it.each(['recent', 'popular', 'trending'])('accepts sort=%s', (sort) => {
    expect(getFeed.query.parse({ sort }).sort).toBe(sort);
  });

  it.each(['standard', 'short'])('accepts format=%s', (format) => {
    expect(getFeed.query.parse({ format }).format).toBe(format);
  });

  it('rejects an unknown sort, an unknown format and a non-uuid category', () => {
    expect(getFeed.query.safeParse({ format: 'long' }).success).toBe(false);
    expect(getFeed.query.safeParse({ sort: 'oldest' }).success).toBe(false);
    expect(getFeed.query.safeParse({ categoryId: 'games' }).success).toBe(false);
  });
});
