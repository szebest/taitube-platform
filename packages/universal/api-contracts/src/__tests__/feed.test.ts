import { FEED_SORTS, FeedQuerySchema, getFeed } from '../feed';

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
    expect(FeedQuerySchema.parse({})).toEqual({ sort: 'recent', limit: 20 });
  });

  it.each(FEED_SORTS)('accepts sort=%s', (sort) => {
    expect(FeedQuerySchema.parse({ sort }).sort).toBe(sort);
  });

  it('rejects an unknown sort and a non-uuid category', () => {
    expect(FeedQuerySchema.safeParse({ sort: 'oldest' }).success).toBe(false);
    expect(FeedQuerySchema.safeParse({ categoryId: 'games' }).success).toBe(false);
  });
});
