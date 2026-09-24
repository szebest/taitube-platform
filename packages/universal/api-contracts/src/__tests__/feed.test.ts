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

  it('defaults sort to recent and limit to 20', () => {
    expect(getFeed.query.parse({})).toEqual({ sort: 'recent', limit: 20 });
  });

  it.each(['recent', 'popular', 'trending'])('accepts sort=%s', (sort) => {
    expect(getFeed.query.parse({ sort }).sort).toBe(sort);
  });

  it('rejects an unknown sort and a non-uuid category', () => {
    expect(getFeed.query.safeParse({ sort: 'oldest' }).success).toBe(false);
    expect(getFeed.query.safeParse({ categoryId: 'games' }).success).toBe(false);
  });
});
